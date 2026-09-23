use rusqlite::{params, Connection, OptionalExtension};
use serde::Deserialize;

use crate::{champion::Champion, error::AppResult};

const MIGRATIONS: [(&str, &str); 1] = [(
    "0001_initial",
    include_str!("../../../migrations/0001_initial.sql"),
)];

#[derive(Deserialize)]
struct DatasetMetadata {
    version: String,
}

pub fn initialize(connection: &mut Connection) -> AppResult<()> {
    apply_migrations(connection)?;

    let metadata: DatasetMetadata =
        serde_json::from_str(include_str!("../../../resources/data/dataset-meta.json"))?;
    let current_version: Option<String> = connection
        .query_row(
            "SELECT value FROM app_metadata WHERE key = 'dataset_version'",
            [],
            |row| row.get(0),
        )
        .optional()?;
    if current_version.as_deref() == Some(metadata.version.as_str()) {
        return Ok(());
    }

    let champions: Vec<Champion> =
        serde_json::from_str(include_str!("../../../resources/data/champions.json"))?;
    let transaction = connection.transaction()?;
    transaction.execute("DELETE FROM champions", [])?;
    for champion in champions {
        transaction.execute(
            "INSERT INTO champions (id, name, roles, image) VALUES (?1, ?2, ?3, ?4)",
            params![
                champion.id,
                champion.name,
                champion.roles.join(","),
                champion.image
            ],
        )?;
    }
    transaction.execute(
        "INSERT INTO app_metadata (key, value) VALUES ('dataset_version', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [metadata.version],
    )?;
    transaction.commit()?;
    Ok(())
}

pub fn get_all(connection: &Connection) -> AppResult<Vec<Champion>> {
    let mut statement =
        connection.prepare("SELECT id, name, roles, image FROM champions ORDER BY name")?;
    let rows = statement.query_map([], |row| {
        let roles: String = row.get(2)?;
        Ok(Champion {
            id: row.get(0)?,
            name: row.get(1)?,
            roles: roles
                .split(',')
                .filter(|role| !role.is_empty())
                .map(String::from)
                .collect(),
            image: row.get(3)?,
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
}

fn apply_migrations(connection: &mut Connection) -> AppResult<()> {
    connection.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);",
    )?;

    for (version, sql) in MIGRATIONS {
        let applied: bool = connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = ?1)",
            [version],
            |row| row.get(0),
        )?;
        if applied {
            continue;
        }

        let transaction = connection.transaction()?;
        transaction.execute_batch(sql)?;
        transaction.execute(
            "INSERT INTO schema_migrations (version) VALUES (?1)",
            [version],
        )?;
        transaction.commit()?;
    }
    Ok(())
}

#[cfg(test)]
#[path = "../../../tests/unit/champion_repository.rs"]
mod tests;
