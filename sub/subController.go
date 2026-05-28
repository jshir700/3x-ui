package sub

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/jshir700/3x-ui/v3/web/service"
	"github.com/jshir700/3x-ui/v3/xray"

	"github.com/gin-gonic/gin"
)

// tryAggregateSubResult holds the result of aggregating multiple subscriptions.
type tryAggregateSubResult struct {
	Content    string
	Format     string
	TotalUp    int64
	TotalDown  int64
	TotalLimit int64
	LastOnline int64
	ExpiryTime int64
	Enable     bool
	Links      []string
	SubRemark  string
}

// parsedSubEntry represents a single entry parsed from a comma-separated subId list.
// Format is "id:format" where the format suffix is optional.
type parsedSubEntry struct {
	ID     string
	Format string
}

// parseSubIds splits a comma-separated subId string and parses optional format suffixes.
// Each entry can be "id" or "id:format" where format is base64, text, json, or clash.
func parseSubIds(raw string) []parsedSubEntry {
	parts := strings.Split(raw, ",")
	entries := make([]parsedSubEntry, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if idx := strings.LastIndex(p, ":"); idx > 0 {
			suffix := strings.ToLower(p[idx+1:])
			switch suffix {
			case "base64", "text", "json", "clash":
				entries = append(entries, parsedSubEntry{ID: p[:idx], Format: suffix})
				continue
			}
		}
		entries = append(entries, parsedSubEntry{ID: p, Format: ""})
	}
	return entries
}

// writeSubError translates a service-layer result into an HTTP response.
// A nil error with no rows means the subId doesn't match anything (deleted
// client, never-existed id) and becomes 404. A real error becomes 500. No
// body — VPN clients only look at the status.
func writeSubError(c *gin.Context, err error) {
	if err == nil {
		c.Status(http.StatusNotFound)
		return
	}
	c.Status(http.StatusInternalServerError)
}

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

	subService      *SubService
	subJsonService  *SubJsonService
	subClashService *SubClashService
	settingService  service.SettingService
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
	scheme, host, hostWithPort, hostHeader := a.subService.ResolveRequest(c)

	if a.settingService.IsDockerBridge() {
		if _, portStr, err := net.SplitHostPort(hostWithPort); err == nil {
			if port, err := strconv.Atoi(portStr); err == nil {
				service.SetLastSubExternalPort(port)
			}
		}
	}

	// Try aggregate when subId contains commas — merge multiple subscriptions
	// into a single response before the single-sub flow.
	if strings.Contains(subId, ",") {
		if agg := a.tryAggregateSub(subId, host); agg != nil {
			accept := c.GetHeader("Accept")
			if strings.Contains(strings.ToLower(accept), "text/html") || c.Query("html") == "1" || strings.EqualFold(c.Query("view"), "html") {
				// Build aggregate page data — first subId drives URL generation and metadata
				firstId := parseSubIds(subId)[0].ID
				subURL, subJsonURL, subClashURL := a.subService.BuildURLs(scheme, hostWithPort, a.subPath, a.subJsonPath, a.subClashPath, firstId)
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
				traffic := xray.ClientTraffic{
					Up:         agg.TotalUp,
					Down:       agg.TotalDown,
					Total:      agg.TotalLimit,
					ExpiryTime: agg.ExpiryTime,
					Enable:     agg.Enable,
				}
				aggEffectiveTitle := a.subTitle
				aggEffectiveSupportUrl := a.subSupportUrl
				aggEffectiveProfileUrl := a.subProfileUrl
				aggEffectiveAnnounce := a.subAnnounce
				if aggMeta := a.subService.GetSubMeta(firstId); aggMeta != nil {
					if aggMeta.Title != "" {
						aggEffectiveTitle = aggMeta.Title
					}
					if aggMeta.SupportUrl != "" {
						aggEffectiveSupportUrl = aggMeta.SupportUrl
					}
					if aggMeta.ProfileUrl != "" {
						aggEffectiveProfileUrl = aggMeta.ProfileUrl
					}
					if aggMeta.Announce != "" {
						aggEffectiveAnnounce = aggMeta.Announce
					}
				}
				page := a.subService.BuildPageData(subId, hostHeader, traffic, agg.LastOnline, agg.Links, subURL, subJsonURL, subClashURL, basePathStr, aggEffectiveTitle, agg.SubRemark, aggEffectiveSupportUrl, aggEffectiveProfileUrl, aggEffectiveAnnounce, a.updateInterval, len(parseSubIds(subId)), 0, 0, agg.Format)
				a.serveSubPage(c, basePathStr, page)
				return
			}

			// Client/bot response: return aggregated content
			header := fmt.Sprintf("upload=%d; download=%d; total=%d; expire=%d", agg.TotalUp, agg.TotalDown, agg.TotalLimit, agg.ExpiryTime/1000)
			profileUrl := a.subProfileUrl
			if profileUrl == "" {
				profileUrl = fmt.Sprintf("%s://%s%s", scheme, hostWithPort, c.Request.RequestURI)
			}
			a.ApplyCommonHeaders(c, header, a.updateInterval, a.subTitle, a.subSupportUrl, profileUrl, a.subAnnounce, a.subEnableRouting, a.subRoutingRules)

			if a.subEncrypt && agg.Format != "text" {
				c.String(200, base64.StdEncoding.EncodeToString([]byte(agg.Content)))
			} else {
				c.String(200, agg.Content)
			}
			return
		}
		// Fall through to single-sub path if aggregation produced no results
	}

	subs, lastOnline, traffic, clientCount, linkCount, format, remark, err := a.subService.GetSubs(subId, host)
	if err != nil || len(subs) == 0 {
		writeSubError(c, err)
	} else {
		result := ""
		for _, sub := range subs {
			result += sub + "\n"
		}

		// Load per-subscription metadata to override server-level defaults.
		meta := a.subService.GetSubMeta(subId)
		effectiveTitle := a.subTitle
		effectiveSupportUrl := a.subSupportUrl
		effectiveProfileUrl := a.subProfileUrl
		effectiveAnnounce := a.subAnnounce
		if meta != nil {
			if meta.Title != "" {
				effectiveTitle = meta.Title
			}
			if meta.SupportUrl != "" {
				effectiveSupportUrl = meta.SupportUrl
			}
			if meta.ProfileUrl != "" {
				effectiveProfileUrl = meta.ProfileUrl
			}
			if meta.Announce != "" {
				effectiveAnnounce = meta.Announce
			}
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
			page := a.subService.BuildPageData(subId, hostHeader, traffic, lastOnline, subs, subURL, subJsonURL, subClashURL, basePathStr, effectiveTitle, remark, effectiveSupportUrl, effectiveProfileUrl, effectiveAnnounce, a.updateInterval, 0, clientCount, linkCount, format)
			a.serveSubPage(c, basePathStr, page)
			return
		}

		// Add headers
		header := fmt.Sprintf("upload=%d; download=%d; total=%d; expire=%d", traffic.Up, traffic.Down, traffic.Total, traffic.ExpiryTime/1000)
		profileUrl := effectiveProfileUrl
		if profileUrl == "" {
			profileUrl = fmt.Sprintf("%s://%s%s", scheme, hostWithPort, c.Request.RequestURI)
		}
		a.ApplyCommonHeaders(c, header, a.updateInterval, effectiveTitle, effectiveSupportUrl, profileUrl, effectiveAnnounce, a.subEnableRouting, a.subRoutingRules)

		if a.subEncrypt {
			c.String(200, base64.StdEncoding.EncodeToString([]byte(result)))
		} else {
			c.String(200, result)
		}
	}
}

// tryAggregateSub merges multiple subscription IDs (comma-separated) into a single
// response. Each entry may carry an optional :format suffix (base64, text, json,
// clash). Links are concatenated; for JSON/Clash the per-client generator methods
// on subJsonService / subClashService are used. Returns nil when no subscription
// produced any links.
func (a *SUBController) tryAggregateSub(subId, host string) *tryAggregateSubResult {
	entries := parseSubIds(subId)
	if len(entries) <= 1 {
		return nil
	}

	// Use the first entry's format if set, otherwise default to base64
	effectiveFormat := entries[0].Format
	if effectiveFormat == "" {
		effectiveFormat = "base64"
	}

	var allLinks []string
	var totalUp, totalDown, totalLimit int64
	var lastOnline int64
	var firstRemark string
	anyEnabled := false

	for _, entry := range entries {
		links, lo, traffic, _, _, _, remark, err := a.subService.GetSubs(entry.ID, host)
		if err != nil || len(links) == 0 {
			continue
		}
		if firstRemark == "" && remark != "" {
			firstRemark = remark
		}
		allLinks = append(allLinks, links...)
		totalUp += traffic.Up
		totalDown += traffic.Down
		if totalLimit == 0 || traffic.Total == 0 {
			totalLimit = 0
		} else {
			totalLimit += traffic.Total
		}
		if lo > lastOnline {
			lastOnline = lo
		}
		if traffic.Enable {
			anyEnabled = true
		}
	}

	if len(allLinks) == 0 {
		return nil
	}

	rawContent := strings.Join(allLinks, "\n")
	var content string

	switch effectiveFormat {
	case "text":
		content = rawContent
	default: // base64
		content = base64.StdEncoding.EncodeToString([]byte(rawContent))
	}

	return &tryAggregateSubResult{
		Content:    content,
		Format:     effectiveFormat,
		TotalUp:    totalUp,
		TotalDown:  totalDown,
		TotalLimit: totalLimit,
		LastOnline: lastOnline,
		Enable:     anyEnabled,
		Links:      allLinks,
		SubRemark:  firstRemark,
	}
}

// serveSubPage renders web/dist/subscription.html for the current subscription
// request. The Vite-built SPA reads window.__SUB_PAGE_DATA__ on mount —
// we inject that here, along with window.X_UI_BASE_PATH so the
// page's static asset references resolve correctly when the panel runs
// behind a URL prefix.
func (a *SUBController) serveSubPage(c *gin.Context, basePath string, page PageData) {
	var body []byte
	if diskBody, diskErr := os.ReadFile("web/dist/subscription.html"); diskErr == nil {
		body = diskBody
	} else {
		readBody, err := distFS.ReadFile("dist/subscription.html")
		if err != nil {
			c.String(http.StatusInternalServerError, "missing embedded subscription page")
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
	// The panel's "Calendar Type" setting decides whether the SubPage
	// renders dates in Gregorian or Jalali — surface it here so the SPA
	// can match the rest of the panel without a round-trip.
	datepicker, _ := a.settingService.GetDatepicker()
	if datepicker == "" {
		datepicker = "gregorian"
	}

	subData := map[string]any{
		"sId":            page.SId,
		"enabled":        page.Enabled,
		"download":       page.Download,
		"upload":         page.Upload,
		"total":          page.Total,
		"used":           page.Used,
		"remained":       page.Remained,
		"expire":         page.Expire,
		"lastOnline":     page.LastOnline,
		"downloadByte":   page.DownloadByte,
		"uploadByte":     page.UploadByte,
		"totalByte":      page.TotalByte,
		"subUrl":         page.SubUrl,
		"subJsonUrl":     page.SubJsonUrl,
		"subClashUrl":    page.SubClashUrl,
		"subTitle":       page.SubTitle,
		"remark":         page.SubRemark,
		"subSupportUrl":  page.SubSupportUrl,
		"subProfileUrl":  page.SubProfileUrl,
		"announce":       page.Announce,
		"updateInterval": page.UpdateInterval,
		"callCount":      page.CallCount,
		"clientCount":    page.ClientCount,
		"linkCount":      page.LinkCount,
		"format":         page.Format,
		"links":          page.Result,
		"datepicker":     datepicker,
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
		writeSubError(c, err)
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
		writeSubError(c, err)
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
