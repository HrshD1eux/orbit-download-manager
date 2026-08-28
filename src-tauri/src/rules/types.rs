use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConditionField {
    Extension,
    Domain,
    Url,
    FileSize,
    Category,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConditionOperator {
    Equals,
    NotEquals,
    Contains,
    StartsWith,
    GreaterThan,
    LessThan,
    InList,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleCondition {
    pub field: ConditionField,
    pub operator: ConditionOperator,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActionType {
    SetSavePath,
    SetCategory,
    SetPriority,
    SetConnections,
    AutoVerifySha256,
    AutoStart,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleAction {
    pub action_type: ActionType,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub priority_order: i32,
    pub conditions: Vec<RuleCondition>,
    pub actions: Vec<RuleAction>,
    pub created_at: i64,
}
