package service

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"strconv"
	"strings"
	"time"

	"github.com/jshir700/3x-ui/v3/database"
	"github.com/jshir700/3x-ui/v3/database/model"
	"gorm.io/gorm"
)

const subIdCharset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

type SubscriptionService struct{}

func generateSubId() string {
	b := make([]byte, 16)
	for i := range b {
		b[i] = subIdCharset[rand.Intn(len(subIdCharset))]
	}
	return string(b)
}

func init() {
	rand.Seed(time.Now().UnixNano())
}

func (s *SubscriptionService) GetAll() ([]*model.Subscription, error) {
	db := database.GetDB()
	var subs []*model.Subscription
	err := db.Model(model.Subscription{}).Order("id asc").Find(&subs).Error
	return subs, err
}

func (s *SubscriptionService) GetById(id int) (*model.Subscription, error) {
	db := database.GetDB()
	sub := &model.Subscription{}
	err := db.Model(model.Subscription{}).Where("id = ?", id).First(sub).Error
	return sub, err
}

func (s *SubscriptionService) GetBySubId(subId string) (*model.Subscription, error) {
	db := database.GetDB()
	sub := &model.Subscription{}
	err := db.Model(model.Subscription{}).Where("sub_id = ?", subId).First(sub).Error
	return sub, err
}

// GetByInboundId returns subscriptions that contain clients from the given inbound.
func (s *SubscriptionService) GetByInboundId(inboundId int) ([]*model.Subscription, error) {
	db := database.GetDB()
	var subs []*model.Subscription
	// First find the inbound's clients' emails
	inbound := &model.Inbound{}
	if err := db.First(inbound, inboundId).Error; err != nil {
		return nil, err
	}
	emails := extractEmailsFromSettings(inbound.Settings)
	if len(emails) == 0 {
		return nil, nil
	}

	var allSubs []*model.Subscription
	db.Find(&allSubs)
	for _, sub := range allSubs {
		subEmails := parseSubEmails(sub.ClientEmails)
		for _, e := range subEmails {
			for _, targetEmail := range emails {
				if strings.EqualFold(e, targetEmail) {
					subs = append(subs, sub)
					goto nextSub
				}
			}
		}
	nextSub:
	}
	return subs, nil
}

func (s *SubscriptionService) Create(sub *model.Subscription) error {
	db := database.GetDB()
	if sub.SubId == "" {
		sub.SubId = generateSubId()
	}
	sub.CreatedAt = time.Now().UnixMilli()
	sub.UpdatedAt = time.Now().UnixMilli()
	return db.Create(sub).Error
}

func (s *SubscriptionService) Update(id int, in *model.Subscription) error {
	db := database.GetDB()
	updates := map[string]any{
		"sub_id":                   in.SubId,
		"enable":                   in.Enable,
		"format":                   in.Format,
		"password":                 in.Password,
		"client_emails":            in.ClientEmails,
		"expiry_time":              in.ExpiryTime,
		"show_info":                in.ShowInfo,
		"email_in_remark":          in.EmailInRemark,
		"title":                    in.Title,
		"support_url":              in.SupportUrl,
		"profile_url":              in.ProfileUrl,
		"announce":                 in.Announce,
		"update_interval":          in.UpdateInterval,
		"remark":                   in.Remark,
		"sync_with_inbound_order":  in.SyncWithInboundOrder,
		"auto_include_all_enabled": in.AutoIncludeAllEnabled,
		"user_agent_enabled":       in.UserAgentEnabled,
		"user_agent_values":        in.UserAgentValues,
		"updated_at":               time.Now().UnixMilli(),
	}
	return db.Model(model.Subscription{}).Where("id = ?", id).Updates(updates).Error
}

func (s *SubscriptionService) SetEnable(id int, enable bool) error {
	db := database.GetDB()
	return db.Model(model.Subscription{}).Where("id = ?", id).Update("enable", enable).Error
}

func (s *SubscriptionService) Delete(id int) error {
	db := database.GetDB()
	return db.Where("id = ?", id).Delete(model.Subscription{}).Error
}

func (s *SubscriptionService) UpdateLastUsedAt(subId string) {
	db := database.GetDB()
	db.Model(model.Subscription{}).Where("sub_id = ?", subId).Update("last_used_at", time.Now().UnixMilli())
}

func (s *SubscriptionService) IncrementCallCount(subId string) {
	db := database.GetDB()
	db.Model(model.Subscription{}).Where("sub_id = ?", subId).UpdateColumn("call_count", gorm.Expr("call_count + 1"))
}

// RemoveInboundId removes all references to a specific inbound's clients from all subscriptions.
func (s *SubscriptionService) RemoveInboundId(inboundId int) error {
	db := database.GetDB()
	inbound := &model.Inbound{}
	if err := db.First(inbound, inboundId).Error; err != nil {
		return err
	}
	targetEmails := extractEmailsFromSettings(inbound.Settings)

	var allSubs []*model.Subscription
	db.Find(&allSubs)
	for _, sub := range allSubs {
		emails := parseSubEmails(sub.ClientEmails)
		newEmails := make([]string, 0, len(emails))
		for _, e := range emails {
			found := false
			for _, t := range targetEmails {
				if strings.EqualFold(e, t) {
					found = true
					break
				}
			}
			if !found {
				newEmails = append(newEmails, e)
			}
		}
		if len(newEmails) == len(emails) {
			continue
		}
		if len(newEmails) == 0 {
			db.Delete(model.Subscription{}, sub.Id)
		} else {
			db.Model(model.Subscription{}).Where("id = ?", sub.Id).Update("client_emails", joinEmails(newEmails))
		}
	}
	return nil
}

// parseSubEmails splits a comma-separated email string into a slice.
func parseSubEmails(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	emails := make([]string, 0, len(parts))
	for _, p := range parts {
		e := strings.TrimSpace(p)
		if e != "" {
			emails = append(emails, e)
		}
	}
	return emails
}

// joinEmails joins a slice of emails into a comma-separated string.
func joinEmails(emails []string) string {
	return strings.Join(emails, ",")
}

// extractEmailsFromSettings parses inbound settings JSON and returns all client emails.
func extractEmailsFromSettings(settings string) []string {
	var raw map[string]any
	if err := json.Unmarshal([]byte(settings), &raw); err != nil {
		return nil
	}
	var emails []string
	for _, key := range []string{"clients", "accounts", "peers"} {
		if arr, ok := raw[key].([]any); ok {
			for _, item := range arr {
				if m, ok := item.(map[string]any); ok {
					if email, ok := m["email"].(string); ok && email != "" {
						emails = append(emails, email)
					}
				}
			}
		}
	}
	return emails
}

// parseInboundIds extracts bare inbound IDs from a string (strips email parts for LIKE queries).
func parseInboundIds(s string) []int {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	seen := make(map[int]bool)
	var ids []int
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		// New format: email only. We need to look up which inbound this email belongs to.
		// Old format: "inboundId" or "inboundId:clientId" — strip and keep just the inbound ID.
		if strings.Contains(p, "@") {
			continue // email-based entry, not a bare ID
		}
		ref := strings.SplitN(p, ":", 2)
		if id, err := strconv.Atoi(ref[0]); err == nil && id > 0 && !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	return ids
}

// ParseSubClientRefs parses the inboundIds string and returns a slice of emails.
// Also handles legacy "inboundId:clientId" format by mapping to emails.
func (s *SubscriptionService) ParseSubClientRefs(inboundIds string) []string {
	emails := parseSubEmails(inboundIds)
	// If entries look like emails (contain @), they're already in new format
	hasEmails := false
	hasLegacy := false
	for _, e := range emails {
		if strings.Contains(e, "@") {
			hasEmails = true
		} else if strings.Contains(e, ":") || isNumeric(e) {
			hasLegacy = true
		}
	}
	if !hasLegacy {
		return emails
	}
	// Mixed or legacy format — migrate on read
	if hasEmails {
		// Already partially migrated, just return emails
		result := make([]string, 0, len(emails))
		for _, e := range emails {
			if strings.Contains(e, "@") {
				result = append(result, e)
			}
		}
		return result
	}
	// Pure legacy format — resolve to emails
	return s.resolveLegacyRefs(emails)
}

// resolveLegacyRefs converts legacy "inboundId:clientId" entries to emails.
func (s *SubscriptionService) resolveLegacyRefs(entries []string) []string {
	db := database.GetDB()
	var inbounds []*model.Inbound
	db.Find(&inbounds)

	ibMap := make(map[int]*model.Inbound)
	for _, ib := range inbounds {
		ibMap[ib.Id] = ib
	}

	var result []string
	seen := make(map[string]bool)

	for _, entry := range entries {
		parts := strings.SplitN(entry, ":", 2)
		ibId, err := strconv.Atoi(strings.TrimSpace(parts[0]))
		if err != nil || ibId <= 0 {
			continue
		}
		ib, ok := ibMap[ibId]
		if !ok {
			continue
		}

		if len(parts) == 2 {
			// "inboundId:clientId" — find specific client's email
			cid := strings.TrimSpace(parts[1])
			email := findClientEmailById(ib, cid)
			if email != "" && !seen[email] {
				seen[email] = true
				result = append(result, email)
			}
		} else {
			// "inboundId" — all clients of this inbound
			for _, email := range extractEmailsFromSettings(ib.Settings) {
				if !seen[email] {
					seen[email] = true
					result = append(result, email)
				}
			}
		}
	}
	return result
}

func findClientEmailById(ib *model.Inbound, clientIdStr string) string {
	var raw map[string]any
	if err := json.Unmarshal([]byte(ib.Settings), &raw); err != nil {
		return ""
	}
	for _, key := range []string{"clients", "accounts", "peers"} {
		arr, ok := raw[key].([]any)
		if !ok {
			continue
		}
		for _, item := range arr {
			m, ok := item.(map[string]any)
			if !ok {
				continue
			}
			if cid, ok := m["clientId"].(float64); ok && fmt.Sprintf("%.0f", cid) == clientIdStr {
				if email, ok := m["email"].(string); ok && email != "" {
					return email
				}
			}
		}
	}
	return ""
}

func isNumeric(s string) bool {
	_, err := strconv.Atoi(s)
	return err == nil
}

// GetClientSubCounts returns the number of enabled subscriptions each client email is linked to.
func (s *SubscriptionService) GetClientSubCounts() (map[string]int, error) {
	db := database.GetDB()

	var subs []*model.Subscription
	if err := db.Model(&model.Subscription{}).Where("enable = ?", true).Find(&subs).Error; err != nil {
		return nil, err
	}

	counts := make(map[string]int)
	for _, sub := range subs {
		counted := make(map[string]bool)
		for _, email := range parseSubEmails(sub.ClientEmails) {
			if !counted[email] {
				counted[email] = true
				counts[email]++
			}
		}
	}
	return counts, nil
}

// GetClientDisabledSubCounts returns the number of disabled or expired subscriptions each client email is linked to.
func (s *SubscriptionService) GetClientDisabledSubCounts() (map[string]int, error) {
	db := database.GetDB()
	now := time.Now().UnixMilli()

	var subs []*model.Subscription
	if err := db.Model(&model.Subscription{}).Where("enable = ? OR (expiry_time > 0 AND expiry_time <= ?)", false, now).Find(&subs).Error; err != nil {
		return nil, err
	}

	counts := make(map[string]int)
	for _, sub := range subs {
		counted := make(map[string]bool)
		for _, email := range parseSubEmails(sub.ClientEmails) {
			if !counted[email] {
				counted[email] = true
				counts[email]++
			}
		}
	}
	return counts, nil
}

// RemoveClientFromSubscriptions removes a specific email from all subscriptions.
func (s *SubscriptionService) RemoveClientFromSubscriptions(email string) (affected, toBeDeleted []int, err error) {
	db := database.GetDB()
	var allSubs []*model.Subscription
	db.Find(&allSubs)
	for _, sub := range allSubs {
		emails := parseSubEmails(sub.ClientEmails)
		newEmails := make([]string, 0, len(emails))
		matched := false
		for _, e := range emails {
			if strings.EqualFold(e, email) {
				matched = true
				continue
			}
			newEmails = append(newEmails, e)
		}
		if !matched {
			continue
		}
		if len(newEmails) == 0 {
			db.Delete(model.Subscription{}, sub.Id)
			toBeDeleted = append(toBeDeleted, sub.Id)
		} else {
			db.Model(model.Subscription{}).Where("id = ?", sub.Id).Update("client_emails", joinEmails(newEmails))
			affected = append(affected, sub.Id)
		}
	}
	return
}

// CheckClientSubscriptions returns subscriptions that reference a specific email.
func (s *SubscriptionService) CheckClientSubscriptions(email string) (affected, toBeDeleted []*model.Subscription, err error) {
	db := database.GetDB()
	var allSubs []*model.Subscription
	db.Find(&allSubs)
	for _, sub := range allSubs {
		emails := parseSubEmails(sub.ClientEmails)
		matched := false
		for _, e := range emails {
			if strings.EqualFold(e, email) {
				matched = true
				break
			}
		}
		if !matched {
			continue
		}
		// Count remaining entries after removing this email
		remaining := 0
		for _, e := range emails {
			if !strings.EqualFold(e, email) {
				remaining++
			}
		}
		if remaining == 0 {
			toBeDeleted = append(toBeDeleted, sub)
		} else {
			affected = append(affected, sub)
		}
	}
	return
}

// AddClientEmail adds an email to a subscription's ClientEmails if not already present.
func (s *SubscriptionService) AddClientEmail(subId int, email string) error {
	db := database.GetDB()
	sub := &model.Subscription{}
	if err := db.First(sub, subId).Error; err != nil {
		return err
	}
	emails := parseSubEmails(sub.ClientEmails)
	for _, e := range emails {
		if strings.EqualFold(e, email) {
			return nil // already present
		}
	}
	emails = append(emails, email)
	return db.Model(sub).Update("client_emails", joinEmails(emails)).Error
}

// RemoveClientEmail removes an email from a subscription's ClientEmails.
// If the email was the only one, the subscription is NOT deleted — callers
// should use CheckClientSubscriptions first to decide whether to delete.
func (s *SubscriptionService) RemoveClientEmail(subId int, email string) error {
	db := database.GetDB()
	sub := &model.Subscription{}
	if err := db.First(sub, subId).Error; err != nil {
		return err
	}
	emails := parseSubEmails(sub.ClientEmails)
	newEmails := make([]string, 0, len(emails))
	for _, e := range emails {
		if !strings.EqualFold(e, email) {
			newEmails = append(newEmails, e)
		}
	}
	return db.Model(sub).Update("client_emails", joinEmails(newEmails)).Error
}

// SyncSubscriptionAssociations ensures a client email is present in exactly
// the specified subscription IDs and absent from all others.
func (s *SubscriptionService) SyncSubscriptionAssociations(email string, targetIds []int) error {
	db := database.GetDB()
	targetSet := make(map[int]bool, len(targetIds))
	for _, id := range targetIds {
		targetSet[id] = true
	}
	var allSubs []*model.Subscription
	db.Find(&allSubs)
	for _, sub := range allSubs {
		emails := parseSubEmails(sub.ClientEmails)
		hasEmail := false
		for _, e := range emails {
			if strings.EqualFold(e, email) {
				hasEmail = true
				break
			}
		}
		if targetSet[sub.Id] {
			if !hasEmail {
				emails = append(emails, email)
				if err := db.Model(sub).Update("client_emails", joinEmails(emails)).Error; err != nil {
					return err
				}
			}
		} else {
			if hasEmail {
				newEmails := make([]string, 0, len(emails))
				for _, e := range emails {
					if !strings.EqualFold(e, email) {
						newEmails = append(newEmails, e)
					}
				}
				if err := db.Model(sub).Update("client_emails", joinEmails(newEmails)).Error; err != nil {
					return err
				}
			}
		}
	}
	return nil
}

// SyncClientEmail updates all subscriptions when a client's email changes.
func (s *SubscriptionService) SyncClientEmail(oldEmail, newEmail string) error {
	if oldEmail == "" || newEmail == "" || strings.EqualFold(oldEmail, newEmail) {
		return nil
	}
	db := database.GetDB()
	var allSubs []*model.Subscription
	db.Find(&allSubs)
	for _, sub := range allSubs {
		emails := parseSubEmails(sub.ClientEmails)
		changed := false
		for i, e := range emails {
			if strings.EqualFold(e, oldEmail) {
				emails[i] = newEmail
				changed = true
			}
		}
		if changed {
			db.Model(model.Subscription{}).Where("id = ?", sub.Id).Update("client_emails", joinEmails(emails))
		}
	}
	return nil
}

// MigrateAllSubscriptions converts all legacy inboundIds formats to email-based format.
func (s *SubscriptionService) MigrateAllSubscriptions() (int, error) {
	db := database.GetDB()
	var subs []*model.Subscription
	db.Find(&subs)

	// Pre-load all inbounds for resolution
	var inbounds []*model.Inbound
	db.Find(&inbounds)
	ibMap := make(map[int]*model.Inbound)
	for _, ib := range inbounds {
		ibMap[ib.Id] = ib
	}

	migrated := 0
	for _, sub := range subs {
		entries := parseSubEmails(sub.ClientEmails)
		needsMigration := false
		for _, e := range entries {
			if !strings.Contains(e, "@") {
				needsMigration = true
				break
			}
		}
		if !needsMigration {
			continue
		}

		newEmails := resolveLegacyRefsStatic(entries, ibMap)
		if len(newEmails) == 0 && len(entries) > 0 {
			continue // couldn't resolve, skip
		}
		db.Model(model.Subscription{}).Where("id = ?", sub.Id).Update("client_emails", joinEmails(newEmails))
		migrated++
	}
	return migrated, nil
}

func resolveLegacyRefsStatic(entries []string, ibMap map[int]*model.Inbound) []string {
	var result []string
	seen := make(map[string]bool)
	for _, entry := range entries {
		parts := strings.SplitN(entry, ":", 2)
		ibId, err := strconv.Atoi(strings.TrimSpace(parts[0]))
		if err != nil || ibId <= 0 {
			continue
		}
		ib, ok := ibMap[ibId]
		if !ok {
			continue
		}
		if len(parts) == 2 {
			cid := strings.TrimSpace(parts[1])
			email := findClientEmailById(ib, cid)
			if email != "" && !seen[email] {
				seen[email] = true
				result = append(result, email)
			}
		} else {
			for _, email := range extractEmailsFromSettings(ib.Settings) {
				if !seen[email] {
					seen[email] = true
					result = append(result, email)
				}
			}
		}
	}
	return result
}
