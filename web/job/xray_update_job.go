package job

import (
	"github.com/mhsanaei/3x-ui/v3/logger"
	"github.com/mhsanaei/3x-ui/v3/web/service"
)

// XrayUpdateJob checks for new Xray versions and updates automatically.
type XrayUpdateJob struct {
	settingService service.SettingService
	serverService  service.ServerService
}

// NewXrayUpdateJob creates a new Xray auto-update job instance.
func NewXrayUpdateJob() *XrayUpdateJob {
	return new(XrayUpdateJob)
}

// Run checks the current Xray version and updates if a newer version is available.
func (j *XrayUpdateJob) Run() {
	enabled, err := j.settingService.GetXrayAutoUpdate()
	if err != nil {
		logger.Warningf("XrayUpdateJob: failed to read auto-update setting: %v", err)
		return
	}
	if !enabled {
		return
	}

	currentVersion := j.serverService.GetCurrentXrayVersion()
	if currentVersion == "Unknown" {
		logger.Debug("XrayUpdateJob: Xray is not running, skipping update check")
		return
	}

	versions, err := j.serverService.GetXrayVersions()
	if err != nil {
		logger.Warningf("XrayUpdateJob: failed to fetch versions: %v", err)
		return
	}
	if len(versions) == 0 {
		return
	}

	latestVersion := versions[0]
	if latestVersion == currentVersion {
		return
	}

	logger.Infof("XrayUpdateJob: updating Xray from %s to %s", currentVersion, latestVersion)
	if err := j.serverService.UpdateXray(latestVersion); err != nil {
		logger.Errorf("XrayUpdateJob: update failed: %v", err)
	}
}
