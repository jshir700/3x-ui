package sub

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/mhsanaei/3x-ui/v3/database"
	"github.com/mhsanaei/3x-ui/v3/database/model"
	"github.com/mhsanaei/3x-ui/v3/logger"
	"github.com/mhsanaei/3x-ui/v3/util/common"
	"github.com/mhsanaei/3x-ui/v3/web/service"

	"github.com/gin-gonic/gin"
	"github.com/goccy/go-yaml"
)

// SUBController handles HTTP requests for subscription links and JSON configurations.
type SUBController struct {
	subTitle         string
	subSupportUrl    string
	subProfileUrl    string
	subAnnounce      string
	subEnableRouting bool
	subRoutingRules  string
	subPath          string
	subJsonPath      string
	subClashPath     string
	jsonEnabled      bool
	clashEnabled     bool
	subEncrypt       bool
	updateInterval   string

	subService         *SubService
	subJsonService     *SubJsonService
	subClashService    *SubClashService
	settingService     service.SettingService
	subscriptionService service.SubscriptionService
}

// NewSUBController creates a new subscription controller with the given configuration.
func NewSUBController(
	g *gin.RouterGroup,
	subPath string,
	jsonPath string,
	clashPath string,
	jsonEnabled bool,
	clashEnabled bool,
	encrypt bool,
	showInfo bool,
	rModel string,
	update string,
	jsonFragment string,
	jsonNoise string,
	jsonMux string,
	jsonRules string,
	subTitle string,
	subSupportUrl string,
	subProfileUrl string,
	subAnnounce string,
	subEnableRouting bool,
	subRoutingRules string,
) *SUBController {
	sub := NewSubService(showInfo, rModel)
	a := &SUBController{
		subTitle:         subTitle,
		subSupportUrl:    subSupportUrl,
		subProfileUrl:    subProfileUrl,
		subAnnounce:      subAnnounce,
		subEnableRouting: subEnableRouting,
		subRoutingRules:  subRoutingRules,
		subPath:          subPath,
		subJsonPath:      jsonPath,
		subClashPath:     clashPath,
		jsonEnabled:      jsonEnabled,
		clashEnabled:     clashEnabled,
		subEncrypt:       encrypt,
		updateInterval:   update,

		subService:      sub,
		subJsonService:  NewSubJsonService(jsonFragment, jsonNoise, jsonMux, jsonRules, sub),
		subClashService: NewSubClashService(sub),
	}
	a.initRouter(g)
	return a
}

// initRouter registers HTTP routes for subscription links and JSON endpoints
// on the provided router group.
func (a *SUBController) initRouter(g *gin.RouterGroup) {
	gLink := g.Group(a.subPath)
	gLink.GET(":subid", a.subs)
	if a.jsonEnabled {
		gJson := g.Group(a.subJsonPath)
		gJson.GET(":subid", a.subJsons)
	}
	if a.clashEnabled {
		gClash := g.Group(a.subClashPath)
		gClash.GET(":subid", a.subClashs)
	}
}

// subs handles HTTP requests for subscription links, returning either HTML page or base64-encoded subscription data.
func (a *SUBController) subs(c *gin.Context) {
	subId := c.Param("subid")
	password := c.Query("pwd")
	scheme, host, hostWithPort, hostHeader := a.subService.ResolveRequest(c)

	// First check: aggregate subscription (new system)
	userAgent := c.GetHeader("User-Agent")
	aggRes, aggErr := a.tryAggregateSub(subId, password, host, userAgent)
	if aggErr == nil {
		accept := c.GetHeader("Accept")
		if strings.Contains(strings.ToLower(accept), "text/html") || c.Query("html") == "1" || strings.EqualFold(c.Query("view"), "html") {
			// Browser: serve the SPA (SubPage.vue) with language selector
			basePath, _ := c.Get("base_path")
			basePathStr, _ := basePath.(string)
			if basePathStr == "" {
				basePathStr = "/"
			}
			buildSubURL := func(baseURL string) string {
				if aggRes.Password != "" {
					sep := "?"
					if strings.Contains(baseURL, "?") {
						sep = "&"
					}
					return baseURL + sep + "pwd=" + aggRes.Password
				}
				return baseURL
			}
			subURL := buildSubURL(fmt.Sprintf("%s://%s%s%s", scheme, hostWithPort, a.subPath, subId))
			subJsonURL := ""
			subClashURL := ""
			if a.jsonEnabled {
				subJsonURL = buildSubURL(fmt.Sprintf("%s://%s%s%s", scheme, hostWithPort, a.subJsonPath, subId))
			}
			if a.clashEnabled {
				subClashURL = buildSubURL(fmt.Sprintf("%s://%s%s%s", scheme, hostWithPort, a.subClashPath, subId))
			}

			download := common.FormatTraffic(aggRes.TotalDown)
			upload := common.FormatTraffic(aggRes.TotalUp)
			totalStr := "∞"
			usedStr := common.FormatTraffic(aggRes.TotalUp + aggRes.TotalDown)
			remainedStr := ""
			if aggRes.TotalLimit > 0 {
				totalStr = common.FormatTraffic(aggRes.TotalLimit)
				left := aggRes.TotalLimit - (aggRes.TotalUp + aggRes.TotalDown)
				if left < 0 {
					left = 0
				}
				remainedStr = common.FormatTraffic(left)
			}

			page := PageData{
				Host:           host,
				BasePath:       basePathStr,
				SId:            subId,
				Format:         aggRes.Format,
				Enabled:        true,
				Download:       download,
				Upload:         upload,
				Total:          totalStr,
				Used:           usedStr,
				Remained:       remainedStr,
				Expire:         aggRes.ExpiryTime / 1000,
				LastOnline:     aggRes.LastOnline,
				DownloadByte:   aggRes.TotalDown,
				UploadByte:     aggRes.TotalUp,
				TotalByte:      aggRes.TotalLimit,
				SubUrl:         subURL,
				SubJsonUrl:     subJsonURL,
				SubClashUrl:    subClashURL,
				SubTitle:       aggRes.Title,
				SubSupportUrl:  aggRes.SupportUrl,
				SubProfileUrl:  aggRes.ProfileUrl,
				Announce:       aggRes.Announce,
				UpdateInterval: aggRes.UpdateInterval,
				CallCount:      aggRes.CallCount,
				Result:         []string{aggRes.Content},
			}
			a.serveSubPage(c, basePathStr, page)
			return
		}
		// curl / client apps: return content as-is (already formatted)
		c.String(200, aggRes.Content)
		return
	}

	// User-Agent mismatch → return 404 immediately (do not fall back to legacy)
	if aggErr != nil && strings.Contains(aggErr.Error(), "user-agent") {
		c.String(404, "404 Not Found")
		return
	}

	// Fallback: legacy per-client subscription
	subs, lastOnline, traffic, err := a.subService.GetSubs(subId, host)
	if err != nil || len(subs) == 0 {
		c.String(400, "Error!")
	} else {
		result := ""
		for _, sub := range subs {
			result += sub + "\n"
		}

		// If the request expects HTML (e.g., browser) or explicitly asked (?html=1 or ?view=html), render the info page here
		accept := c.GetHeader("Accept")
		if strings.Contains(strings.ToLower(accept), "text/html") || c.Query("html") == "1" || strings.EqualFold(c.Query("view"), "html") {
			subURL, subJsonURL, subClashURL := a.subService.BuildURLs(scheme, hostWithPort, a.subPath, a.subJsonPath, a.subClashPath, subId)
			if !a.jsonEnabled {
				subJsonURL = ""
			}
			if !a.clashEnabled {
				subClashURL = ""
			}
			basePath, exists := c.Get("base_path")
			if !exists {
				basePath = "/"
			}
			basePathStr := basePath.(string)
			page := a.subService.BuildPageData(subId, hostHeader, traffic, lastOnline, subs, subURL, subJsonURL, subClashURL, basePathStr, a.subTitle, a.subSupportUrl, a.subProfileUrl, a.subAnnounce, 0, 0, "")
			a.serveSubPage(c, basePathStr, page)
			return
		}

		// Add headers
		header := fmt.Sprintf("upload=%d; download=%d; total=%d; expire=%d", traffic.Up, traffic.Down, traffic.Total, traffic.ExpiryTime/1000)
		profileUrl := a.subProfileUrl
		if profileUrl == "" {
			profileUrl = fmt.Sprintf("%s://%s%s", scheme, hostWithPort, c.Request.RequestURI)
		}
		a.ApplyCommonHeaders(c, header, a.updateInterval, a.subTitle, a.subSupportUrl, profileUrl, a.subAnnounce, a.subEnableRouting, a.subRoutingRules)

		if a.subEncrypt {
			c.String(200, base64.StdEncoding.EncodeToString([]byte(result)))
		} else {
			c.String(200, result)
		}
	}
}

// serveSubPage renders web/dist/subpage.html for the current subscription
// request. The Vite-built SPA reads window.__SUB_PAGE_DATA__ on mount —
// we inject that here, along with window.X_UI_BASE_PATH so the
// page's static asset references resolve correctly when the panel runs
// behind a URL prefix.
func (a *SUBController) serveSubPage(c *gin.Context, basePath string, page PageData) {
	var body []byte
	if diskBody, diskErr := os.ReadFile("web/dist/subpage.html"); diskErr == nil {
		body = diskBody
	} else {
		readBody, err := distFS.ReadFile("dist/subpage.html")
		if err != nil {
			c.String(http.StatusInternalServerError, "missing embedded subpage")
			return
		}
		body = readBody
	}

	// Vite emits absolute asset URLs (`/assets/...`); when the panel is
	// installed under a custom URL prefix, rewrite them so the bundle
	// loads from `<basePath>assets/...` where the static handler is
	// actually mounted.
	if basePath != "/" && basePath != "" {
		body = bytes.ReplaceAll(body, []byte(`src="/assets/`), []byte(`src="`+basePath+`assets/`))
		body = bytes.ReplaceAll(body, []byte(`href="/assets/`), []byte(`href="`+basePath+`assets/`))
	}

	// JSON-marshal the view-model so the SPA can read it as a plain
	// object on mount. PageData fields are already in the shape the Vue
	// component expects, plus a `links` array carrying the rendered
	// share URLs.
	// The panel's "Calendar Type" setting decides whether the SubPage
	// renders dates in Gregorian or Jalali — surface it here so the SPA
	// can match the rest of the panel without a round-trip.
	datepicker, _ := a.settingService.GetDatepicker()
	if datepicker == "" {
		datepicker = "gregorian"
	}

		subData := map[string]any{
		"sId":		page.SId,
		"enabled":		page.Enabled,
		"format":		page.Format,
		"download":		page.Download,
		"upload":		page.Upload,
		"total":		page.Total,
		"used":		page.Used,
		"remained":		page.Remained,
		"expire":		page.Expire,
		"lastOnline":		page.LastOnline,
		"downloadByte":		page.DownloadByte,
		"uploadByte":		page.UploadByte,
		"totalByte":		page.TotalByte,
		"subUrl":		page.SubUrl,
		"subJsonUrl":		page.SubJsonUrl,
		"subClashUrl":		page.SubClashUrl,
		"subTitle":		page.SubTitle,
		"subSupportUrl":		page.SubSupportUrl,
		"subProfileUrl":		page.SubProfileUrl,
		"announce":		page.Announce,
		"updateInterval":		page.UpdateInterval,
		"callCount":		page.CallCount,
		"links":		page.Result,
		"datepicker":		datepicker,
	}
	subDataJSON, err := json.Marshal(subData)
	if err != nil {
		subDataJSON = []byte("{}")
	}

	// Defense-in-depth string-escape for the basePath embed — admin-
	// controlled but cheap to harden.
	jsEscape := strings.NewReplacer(
		`\`, `\\`,
		`"`, `\"`,
		"\n", `\n`,
		"\r", `\r`,
		"<", `<`,
		">", `>`,
		"&", `&`,
	)
	escapedBase := jsEscape.Replace(basePath)

	inject := []byte(`<script>window.X_UI_BASE_PATH="` + escapedBase + `";` +
		`window.__SUB_PAGE_DATA__=` + string(subDataJSON) + `;</script></head>`)
	out := bytes.Replace(body, []byte("</head>"), inject, 1)

	c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Header("Pragma", "no-cache")
	c.Header("Expires", "0")
	c.Data(http.StatusOK, "text/html; charset=utf-8", out)
}

// subJsons handles HTTP requests for JSON subscription configurations.
func (a *SUBController) subJsons(c *gin.Context) {
	subId := c.Param("subid")
	scheme, host, hostWithPort, _ := a.subService.ResolveRequest(c)
	jsonSub, header, err := a.subJsonService.GetJson(subId, host)
	if err != nil || len(jsonSub) == 0 {
		c.String(400, "Error!")
	} else {
		profileUrl := a.subProfileUrl
		if profileUrl == "" {
			profileUrl = fmt.Sprintf("%s://%s%s", scheme, hostWithPort, c.Request.RequestURI)
		}
		a.ApplyCommonHeaders(c, header, a.updateInterval, a.subTitle, a.subSupportUrl, profileUrl, a.subAnnounce, a.subEnableRouting, a.subRoutingRules)

		c.String(200, jsonSub)
	}
}

func (a *SUBController) subClashs(c *gin.Context) {
	subId := c.Param("subid")
	scheme, host, hostWithPort, _ := a.subService.ResolveRequest(c)
	clashSub, header, err := a.subClashService.GetClash(subId, host)
	if err != nil || len(clashSub) == 0 {
		c.String(400, "Error!")
	} else {
		profileUrl := a.subProfileUrl
		if profileUrl == "" {
			profileUrl = fmt.Sprintf("%s://%s%s", scheme, hostWithPort, c.Request.RequestURI)
		}
		a.ApplyCommonHeaders(c, header, a.updateInterval, a.subTitle, a.subSupportUrl, profileUrl, a.subAnnounce, a.subEnableRouting, a.subRoutingRules)
		c.Data(200, "application/yaml; charset=utf-8", []byte(clashSub))
	}
}

// ApplyCommonHeaders sets common HTTP headers for subscription responses including user info, update interval, and profile title.
func (a *SUBController) ApplyCommonHeaders(
	c *gin.Context,
	header,
	updateInterval,
	profileTitle string,
	profileSupportUrl string,
	profileUrl string,
	profileAnnounce string,
	profileEnableRouting bool,
	profileRoutingRules string,
) {
	c.Writer.Header().Set("Subscription-Userinfo", header)
	c.Writer.Header().Set("Profile-Update-Interval", updateInterval)

	//Basics
	if profileTitle != "" {
		c.Writer.Header().Set("Profile-Title", "base64:"+base64.StdEncoding.EncodeToString([]byte(profileTitle)))
	}
	if profileSupportUrl != "" {
		c.Writer.Header().Set("Support-Url", profileSupportUrl)
	}
	if profileUrl != "" {
		c.Writer.Header().Set("Profile-Web-Page-Url", profileUrl)
	}
	if profileAnnounce != "" {
		c.Writer.Header().Set("Announce", "base64:"+base64.StdEncoding.EncodeToString([]byte(profileAnnounce)))
	}

	//Advanced (Happ)
	c.Writer.Header().Set("Routing-Enable", strconv.FormatBool(profileEnableRouting))
	if profileRoutingRules != "" {
		c.Writer.Header().Set("Routing", profileRoutingRules)
	}
}

// tryAggregateSubResult holds the formatted result of an aggregate subscription.
type tryAggregateSubResult struct {
	Content        string // final output (text, base64, json, or clash)
	Format         string // the format that was applied
	InboundCount   int
	Remark         string
	SubId          string
	Password       string
	Title          string
	SupportUrl     string
	ProfileUrl     string
	Announce       string
	UpdateInterval int
	ExpiryTime     int64
	LastOnline     int64
	CallCount      int64
	TotalUp        int64
	TotalDown      int64
	TotalLimit     int64
}

// tryAggregateSub checks the subscriptions table for a matching subId and
// returns aggregate proxy links. Returns error if not found or password mismatch.
func (a *SUBController) tryAggregateSub(subId, password, host, userAgent string) (*tryAggregateSubResult, error) {
	globalEnable, _ := a.settingService.GetSubEnable()
	if !globalEnable {
		return nil, fmt.Errorf("subscription service is disabled")
	}

	sub, err := a.subscriptionService.GetBySubId(subId)
	if err != nil {
		return nil, err
	}
	if !sub.Enable {
		return nil, fmt.Errorf("subscription is disabled")
	}
	if sub.ExpiryTime > 0 && time.Now().UnixMilli() > sub.ExpiryTime {
		return nil, fmt.Errorf("subscription has expired")
	}
	if sub.Password != "" && sub.Password != password {
		return nil, fmt.Errorf("invalid password")
	}
	if sub.UserAgentEnabled {
		if sub.UserAgentValues == "" {
			return nil, fmt.Errorf("user-agent filter: no allowed values configured")
		}
		values := strings.Split(sub.UserAgentValues, ",")
		found := false
		for _, v := range values {
			if strings.Contains(strings.ToLower(userAgent), strings.ToLower(strings.TrimSpace(v))) {
				found = true
				break
			}
		}
		if !found {
			return nil, fmt.Errorf("user-agent mismatch")
		}
	}

	// Resolve inbound IDs
	var ids []int
	if sub.AutoIncludeAllEnabled {
		db := database.GetDB()
		db.Model(&model.Inbound{}).Where("enable = ?", true).Order("sort_order ASC, id ASC").Pluck("id", &ids)
	} else {
		ids = parseSubInboundIds(sub.InboundIds)
	}
	if sub.SyncWithInboundOrder {
		db := database.GetDB()
		db.Model(&model.Inbound{}).Where("id IN ?", ids).Order("sort_order ASC, id ASC").Pluck("id", &ids)
	}

	a.subService.PrepareForRequest(host)
	var allLinks []string
	var jsonParts []string
	var clashProxies []map[string]any
	var totalUp, totalDown, totalLimit int64
	enabledCount := 0
	db := database.GetDB()
	for _, id := range ids {
		inbound := &model.Inbound{}
		if err := db.Where("id = ?", id).First(inbound).Error; err != nil {
			continue
		}
		if !inbound.Enable {
			continue
		}
		enabledCount++
		totalUp += inbound.Up
		totalDown += inbound.Down
		totalLimit += inbound.Total
		clients, err := a.subService.inboundService.GetClients(inbound)
		if err != nil || clients == nil {
			continue
		}
		for _, client := range clients {
			if !client.Enable {
				continue
			}
			// Generate link for each client — per-client panic recovery
			func() {
				defer func() {
					if r := recover(); r != nil {
						logger.Warningf("tryAggregateSub: panic in link gen for inbound %d email %s: %v", id, client.Email, r)
					}
				}()
				link := a.subService.GetLink(inbound, client.Email)
				if link != "" {
					allLinks = append(allLinks, link)
				}
				if sub.Format == "json" {
					j := a.subJsonService.GetJsonForClient(inbound, client, host)
					if j != "" {
						jsonParts = append(jsonParts, j)
					}
				}
				if sub.Format == "clash" {
					proxies := a.subClashService.GetClashForClient(inbound, client, host)
					clashProxies = append(clashProxies, proxies...)
				}
			}()
		}
	}
	if len(allLinks) == 0 {
		return nil, fmt.Errorf("no active inbounds in subscription")
	}

	rawContent := strings.Join(allLinks, "\n")
	var output string
	switch sub.Format {
	case "text":
		output = rawContent
	case "json":
		if len(jsonParts) > 0 {
			output = "[" + strings.Join(jsonParts, ",") + "]"
		} else {
			output = "[]"
		}
	case "clash":
		cc := ClashConfig{
			Proxies: clashProxies,
			ProxyGroups: []map[string]any{
				{"name": "PROXY", "type": "select", "proxies": func() []string {
					var names []string
					for _, p := range clashProxies {
						if name, ok := p["name"].(string); ok {
							names = append(names, name)
						}
					}
					names = append(names, "DIRECT")
					return names
				}()},
			},
			Rules: []string{"MATCH,PROXY"},
		}
		yamlBytes, _ := yaml.Marshal(&cc)
		output = string(yamlBytes)
	default: // "base64"
		output = base64.StdEncoding.EncodeToString([]byte(rawContent))
	}

	// Update call count and last used timestamp
	a.subscriptionService.IncrementCallCount(subId)
	a.subscriptionService.UpdateLastUsedAt(subId)

	return &tryAggregateSubResult{
		Content:        output,
		Format:         sub.Format,
		InboundCount:   enabledCount,
		Remark:         sub.Remark,
		SubId:          sub.SubId,
		Title:          sub.Title,
		SupportUrl:     sub.SupportUrl,
		ProfileUrl:     sub.ProfileUrl,
		Announce:       sub.Announce,
		UpdateInterval: sub.UpdateInterval,
		ExpiryTime:     sub.ExpiryTime,
		LastOnline:     sub.LastUsedAt,
		CallCount:      sub.CallCount,
		TotalUp:        totalUp,
		TotalDown:      totalDown,
		TotalLimit:     totalLimit,
	}, nil
}

func parseSubInboundIds(s string) []int {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	ids := make([]int, 0, len(parts))
	seen := make(map[int]bool)
	for _, p := range parts {
		// Handle both "inboundId" and "inboundId:clientId" formats
		trimmed := strings.TrimSpace(p)
		if colonIdx := strings.IndexByte(trimmed, ':'); colonIdx >= 0 {
			trimmed = trimmed[:colonIdx]
		}
		id, err := strconv.Atoi(trimmed)
		if err == nil && id > 0 && !seen[id] {
			ids = append(ids, id)
			seen[id] = true
		}
	}
	return ids
}
