use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Champion {
    pub id: i64,
    pub name: String,
    pub roles: Vec<String>,
    pub image: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct TeamMember {
    pub champion: Champion,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct GeneratedTeams {
    pub blue: Vec<TeamMember>,
    pub red: Vec<TeamMember>,
}
