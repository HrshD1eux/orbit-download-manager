pub mod types;

use crate::core::state::{Download, DownloadPriority};
use std::path::{Path, PathBuf};
use types::{ActionType, ConditionField, ConditionOperator, Rule, RuleCondition};

pub struct RuleEvaluator;

impl RuleEvaluator {
    pub fn evaluate_and_apply(rules: &[Rule], download: &mut Download) {
        let mut enabled_rules: Vec<&Rule> = rules.iter().filter(|r| r.enabled).collect();
        enabled_rules.sort_by_key(|r| r.priority_order);

        for rule in enabled_rules {
            if Self::matches_rule(rule, download) {
                Self::apply_rule(rule, download);
            }
        }
    }

    pub fn matches_rule(rule: &Rule, download: &Download) -> bool {
        if rule.conditions.is_empty() {
            return false;
        }

        for condition in &rule.conditions {
            if !Self::matches_condition(condition, download) {
                return false;
            }
        }
        true
    }

    fn matches_condition(condition: &RuleCondition, download: &Download) -> bool {
        match condition.field {
            ConditionField::Extension => {
                let ext = Path::new(&download.filename)
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                
                Self::match_str_op(&ext, &condition.operator, &condition.value.to_lowercase())
            }
            ConditionField::Domain => {
                let domain = reqwest::Url::parse(&download.url)
                    .ok()
                    .and_then(|u| u.host_str().map(|h| h.to_lowercase()))
                    .unwrap_or_default();

                Self::match_str_op(&domain, &condition.operator, &condition.value.to_lowercase())
            }
            ConditionField::Url => {
                Self::match_str_op(&download.url.to_lowercase(), &condition.operator, &condition.value.to_lowercase())
            }
            ConditionField::Category => {
                Self::match_str_op(&download.category.to_lowercase(), &condition.operator, &condition.value.to_lowercase())
            }
            ConditionField::FileSize => {
                let target_size: u64 = condition.value.parse().unwrap_or(0);
                match condition.operator {
                    ConditionOperator::GreaterThan => download.total_bytes > target_size,
                    ConditionOperator::LessThan => download.total_bytes < target_size,
                    ConditionOperator::Equals => download.total_bytes == target_size,
                    _ => false,
                }
            }
        }
    }

    fn match_str_op(actual: &str, operator: &ConditionOperator, expected: &str) -> bool {
        match operator {
            ConditionOperator::Equals => actual == expected,
            ConditionOperator::NotEquals => actual != expected,
            ConditionOperator::Contains => actual.contains(expected),
            ConditionOperator::StartsWith => actual.starts_with(expected),
            ConditionOperator::InList => {
                let items: Vec<&str> = expected.split(',').map(|s| s.trim()).collect();
                items.iter().any(|&item| item == actual)
            }
            _ => false,
        }
    }

    fn apply_rule(rule: &Rule, download: &mut Download) {
        for action in &rule.actions {
            match action.action_type {
                ActionType::SetSavePath => {
                    let dir = PathBuf::from(&action.value);
                    download.save_location = dir.join(&download.filename).to_string_lossy().to_string();
                }
                ActionType::SetCategory => {
                    download.category = action.value.clone();
                }
                ActionType::SetPriority => {
                    download.priority = match action.value.to_lowercase().as_str() {
                        "urgent" => DownloadPriority::Urgent,
                        "high" => DownloadPriority::High,
                        "low" => DownloadPriority::Low,
                        _ => DownloadPriority::Normal,
                    };
                }
                ActionType::SetConnections => {
                    if let Ok(conns) = action.value.parse::<u32>() {
                        download.connections = conns.clamp(1, 32);
                    }
                }
                ActionType::AutoVerifySha256 => {
                    // Marker for auto verify
                }
                ActionType::AutoStart => {
                    // Handled during queueing
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use types::{ActionType, ConditionField, ConditionOperator, Rule, RuleAction, RuleCondition};
    use std::collections::HashMap;

    #[test]
    fn test_rule_extension_matching() {
        let mut download = Download {
            id: "test-1".into(),
            url: "https://github.com/release/app.zip".into(),
            headers: HashMap::new(),
            filename: "app.zip".into(),
            save_location: "C:/Downloads/app.zip".into(),
            category: "Unknown".into(),
            status: crate::core::state::DownloadStatus::Queued,
            priority: DownloadPriority::Normal,
            connections: 8,
            speed: 0,
            average_speed: 0,
            peak_speed: 0,
            downloaded_bytes: 0,
            total_bytes: 10_000_000,
            remaining_bytes: 10_000_000,
            eta_seconds: None,
            created_at: 0,
            started_at: None,
            completed_at: None,
            retries: 0,
            mirror_list: vec![],
            etag: None,
            last_modified: None,
            range_supported: true,
            sha256: None,
            md5: None,
            sha1: None,
            tags: vec![],
            notes: "".into(),
            error_message: None,
            chunks: vec![],
            speed_limit_bytes: None,
            proxy_url: None,
            scheduled_start: None,
            post_webhook_command: None,
            audio_url: None,
        };

        let rule = Rule {
            id: "r1".into(),
            name: "GitHub Archives to Development".into(),
            enabled: true,
            priority_order: 1,
            conditions: vec![
                RuleCondition {
                    field: ConditionField::Domain,
                    operator: ConditionOperator::Contains,
                    value: "github.com".into(),
                },
                RuleCondition {
                    field: ConditionField::Extension,
                    operator: ConditionOperator::InList,
                    value: "zip,tar.gz".into(),
                },
            ],
            actions: vec![
                RuleAction {
                    action_type: ActionType::SetCategory,
                    value: "Programming".into(),
                },
                RuleAction {
                    action_type: ActionType::SetPriority,
                    value: "high".into(),
                },
            ],
            created_at: 0,
        };

        RuleEvaluator::evaluate_and_apply(&[rule], &mut download);
        assert_eq!(download.category, "Programming");
        assert_eq!(download.priority, DownloadPriority::High);
    }
}
