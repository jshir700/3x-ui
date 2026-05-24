package service

import (
	"fmt"
	"math/rand"
	"strconv"
	"strings"
	"time"

	"github.com/mhsanaei/3x-ui/v3/database"
	"github.com/mhsanaei/3x-ui/v3/database/model"
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

// GetByInboundId returns subscriptions that contain the given inbound ID.
func (s *SubscriptionService) GetByInboundId(inboundId int) ([]*model.Subscription, error) {
	db := database.GetDB()
	var subs []*model.Subscription
	err := db.Model(model.Subscription{}).Where("inbound_ids LIKE ?", "%"+strconv.Itoa(inboundId)+"%").Find(&subs).Error
	return subs, err
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
		"inbound_ids":              in.InboundIds,
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

// UpdateLastUsedAt updates the last used timestamp for the subscription with the given subId.
func (s *SubscriptionService) UpdateLastUsedAt(subId string) {
	db := database.GetDB()
	db.Model(model.Subscription{}).Where("sub_id = ?", subId).Update("last_used_at", time.Now().UnixMilli())
}

// IncrementCallCount increments the call count for the subscription with the given subId.
func (s *SubscriptionService) IncrementCallCount(subId string) {
	db := database.GetDB()
	db.Model(model.Subscription{}).Where("sub_id = ?", subId).UpdateColumn("call_count", gorm.Expr("call_count + 1"))
}

// RemoveInboundId removes all references to a specific inbound from all subscriptions.
func (s *SubscriptionService) RemoveInboundId(inboundId int) error {
	db := database.GetDB()
	var allSubs []*model.Subscription
	db.Find(&allSubs)
	for _, sub := range allSubs {
		refs := ParseSubClientRefs(sub.InboundIds)
		newRefs := make([]SubClientRef, 0, len(refs))
		for _, ref := range refs {
			if ref.InboundID == inboundId {
				continue // remove all entries for this inbound
			}
			newRefs = append(newRefs, ref)
		}
		if len(newRefs) == len(refs) {
			continue // no change
		}
		if len(newRefs) == 0 {
			db.Delete(model.Subscription{}, sub.Id)
		} else {
			db.Model(model.Subscription{}).Where("id = ?", sub.Id).Update("inbound_ids", joinSubClientRefs(newRefs))
		}
	}
	return nil
}

// SubClientRef represents a single entry in inboundIds: an inbound ID and optionally a client ID.
type SubClientRef struct {
	InboundID int
	ClientID  int // 0 = all clients of the inbound
}

func parseInboundIds(s string) []int {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	ids := make([]int, 0, len(parts))
	for _, p := range parts {
		// Support "inboundId:clientId" format — strip the :clientId part for bare ID lookup
		ref := parseSubClientRef(p)
		ids = append(ids, ref.InboundID)
	}
	return ids
}

func parseSubClientRef(s string) SubClientRef {
	s = strings.TrimSpace(s)
	parts := strings.SplitN(s, ":", 2)
	inboundID, err := strconv.Atoi(parts[0])
	if err != nil {
		return SubClientRef{}
	}
	if len(parts) == 2 {
		clientID, err2 := strconv.Atoi(strings.TrimSpace(parts[1]))
		if err2 == nil && clientID > 0 {
			return SubClientRef{InboundID: inboundID, ClientID: clientID}
		}
	}
	return SubClientRef{InboundID: inboundID, ClientID: 0}
}

// ParseSubClientRefs parses the full inboundIds string into structured references.
func ParseSubClientRefs(s string) []SubClientRef {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	refs := make([]SubClientRef, 0, len(parts))
	for _, p := range parts {
		ref := parseSubClientRef(p)
		if ref.InboundID > 0 {
			refs = append(refs, ref)
		}
	}
	return refs
}

func joinInboundIds(ids []int) string {
	parts := make([]string, len(ids))
	for i, id := range ids {
		parts[i] = strconv.Itoa(id)
	}
	return strings.Join(parts, ",")
}

// joinSubClientRefs serializes a slice of SubClientRef back to the inboundIds string.
func joinSubClientRefs(refs []SubClientRef) string {
	parts := make([]string, 0, len(refs))
	for _, ref := range refs {
		if ref.ClientID > 0 {
			parts = append(parts, fmt.Sprintf("%d:%d", ref.InboundID, ref.ClientID))
		} else {
			parts = append(parts, strconv.Itoa(ref.InboundID))
		}
	}
	return strings.Join(parts, ",")
}

// RemoveClientFromSubscriptions removes a specific inbound+client combination from all subscriptions.
// If a subscription becomes empty, it is deleted. Returns lists of (affected, deleted) subscription IDs.
func (s *SubscriptionService) RemoveClientFromSubscriptions(inboundId, clientId int) (affected, toBeDeleted []int, err error) {
	db := database.GetDB()
	var allSubs []*model.Subscription
	db.Find(&allSubs)
	for _, sub := range allSubs {
		refs := ParseSubClientRefs(sub.InboundIds)
		newRefs := make([]SubClientRef, 0, len(refs))
		matched := false
		for _, ref := range refs {
			if ref.InboundID == inboundId && (ref.ClientID == 0 || ref.ClientID == clientId) {
				matched = true
				continue
			}
			newRefs = append(newRefs, ref)
		}
		if !matched {
			continue
		}
		if len(newRefs) == 0 {
			db.Delete(model.Subscription{}, sub.Id)
			toBeDeleted = append(toBeDeleted, sub.Id)
		} else {
			db.Model(model.Subscription{}).Where("id = ?", sub.Id).Update("inbound_ids", joinSubClientRefs(newRefs))
			affected = append(affected, sub.Id)
		}
	}
	return
}

// CheckClientSubscriptions returns subscriptions that reference a specific inbound+client.
// Returns (affected, toBeDeleted) where toBeDeleted are subscriptions that will become empty.
func (s *SubscriptionService) CheckClientSubscriptions(inboundId, clientId int) (affected, toBeDeleted []*model.Subscription, err error) {
	db := database.GetDB()
	var allSubs []*model.Subscription
	db.Find(&allSubs)
	for _, sub := range allSubs {
		refs := ParseSubClientRefs(sub.InboundIds)
		matched := false
		for _, ref := range refs {
			if ref.InboundID == inboundId && (ref.ClientID == 0 || ref.ClientID == clientId) {
				matched = true
				break
			}
		}
		if !matched {
			continue
		}
		// Check if this ref is the only one
		remaining := 0
		for _, ref := range refs {
			if ref.InboundID == inboundId && (ref.ClientID == 0 || ref.ClientID == clientId) {
				continue
			}
			remaining++
		}
		if remaining == 0 {
			toBeDeleted = append(toBeDeleted, sub)
		} else {
			affected = append(affected, sub)
		}
	}
	return
}
