package controller

import (
	"strconv"

	"github.com/mhsanaei/3x-ui/v3/database/model"
	"github.com/mhsanaei/3x-ui/v3/web/service"

	"github.com/gin-gonic/gin"
)

type SubscriptionController struct {
	subscriptionService service.SubscriptionService
}

func NewSubscriptionController(g *gin.RouterGroup) *SubscriptionController {
	a := &SubscriptionController{}
	a.initRouter(g)
	return a
}

func (a *SubscriptionController) initRouter(g *gin.RouterGroup) {
	g.GET("/list", a.list)
	g.GET("/get/:id", a.get)
	g.POST("/add", a.add)
	g.POST("/update/:id", a.update)
	g.POST("/del/:id", a.del)
	g.POST("/setEnable/:id", a.setEnable)
}

func (a *SubscriptionController) list(c *gin.Context) {
	subs, err := a.subscriptionService.GetAll()
	if err != nil {
		jsonMsg(c, I18nWeb(c, "list"), err)
		return
	}
	jsonObj(c, subs, nil)
}

func (a *SubscriptionController) get(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		jsonMsg(c, I18nWeb(c, "get"), err)
		return
	}
	sub, err := a.subscriptionService.GetById(id)
	if err != nil {
		jsonMsg(c, I18nWeb(c, "pages.nodes.toasts.obtain"), err)
		return
	}
	jsonObj(c, sub, nil)
}

func (a *SubscriptionController) add(c *gin.Context) {
	sub := &model.Subscription{}
	if err := c.ShouldBind(sub); err != nil {
		jsonMsg(c, I18nWeb(c, "add"), err)
		return
	}
	if err := a.subscriptionService.Create(sub); err != nil {
		jsonMsg(c, I18nWeb(c, "add"), err)
		return
	}
	jsonMsgObj(c, I18nWeb(c, "add"), sub, nil)
}

func (a *SubscriptionController) update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		jsonMsg(c, I18nWeb(c, "get"), err)
		return
	}
	sub := &model.Subscription{}
	if err := c.ShouldBind(sub); err != nil {
		jsonMsg(c, I18nWeb(c, "update"), err)
		return
	}
	if err := a.subscriptionService.Update(id, sub); err != nil {
		jsonMsg(c, I18nWeb(c, "update"), err)
		return
	}
	jsonMsg(c, I18nWeb(c, "update"), nil)
}

func (a *SubscriptionController) del(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		jsonMsg(c, I18nWeb(c, "get"), err)
		return
	}
	if err := a.subscriptionService.Delete(id); err != nil {
		jsonMsg(c, I18nWeb(c, "delete"), err)
		return
	}
	jsonMsg(c, I18nWeb(c, "delete"), nil)
}

func (a *SubscriptionController) setEnable(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		jsonMsg(c, I18nWeb(c, "get"), err)
		return
	}
	body := struct {
		Enable bool `json:"enable" form:"enable"`
	}{}
	if err := c.ShouldBind(&body); err != nil {
		jsonMsg(c, I18nWeb(c, "update"), err)
		return
	}
	if err := a.subscriptionService.SetEnable(id, body.Enable); err != nil {
		jsonMsg(c, I18nWeb(c, "update"), err)
		return
	}
	jsonMsg(c, I18nWeb(c, "update"), nil)
}
