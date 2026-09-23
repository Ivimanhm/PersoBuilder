use std::{collections::HashSet, path::Path};

use super::*;

#[test]
fn bundled_dataset_is_complete_and_consistent() {
    let champions: Vec<Champion> =
        serde_json::from_str(include_str!("../../resources/data/champions.json")).unwrap();
    let allowed_roles = ["top", "jungle", "mid", "adc", "support"];
    let mut ids = HashSet::new();

    assert!(champions.len() >= 150);
    for champion in champions {
        assert!(ids.insert(champion.id), "ID duplicado: {}", champion.id);
        assert!(
            !champion.roles.is_empty(),
            "{} no tiene posiciones",
            champion.name
        );
        assert!(champion
            .roles
            .iter()
            .all(|role| allowed_roles.contains(&role.as_str())));
        let portrait = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../frontend/public")
            .join(champion.image.trim_start_matches('/'));
        assert!(portrait.is_file(), "Falta el retrato de {}", champion.name);
    }
}

#[test]
fn initialization_applies_migrations_and_skips_an_unchanged_dataset() {
    let mut connection = Connection::open_in_memory().unwrap();

    initialize(&mut connection).unwrap();
    connection
        .execute(
            "INSERT INTO champions (id, name, roles, image) VALUES (?1, ?2, ?3, ?4)",
            (
                999_999_i64,
                "Prueba persistente",
                "top",
                "/champions/test.png",
            ),
        )
        .unwrap();

    initialize(&mut connection).unwrap();

    let migration_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| {
            row.get(0)
        })
        .unwrap();
    let custom_champion_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM champions WHERE id = 999999",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(migration_count, 1);
    assert_eq!(custom_champion_count, 1);
}

#[test]
fn initialization_upgrades_a_legacy_database() {
    let mut connection = Connection::open_in_memory().unwrap();
    connection.execute_batch(
        "CREATE TABLE app_metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
         CREATE TABLE champions (id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL UNIQUE, roles TEXT NOT NULL, image TEXT NOT NULL DEFAULT '');",
    ).unwrap();

    initialize(&mut connection).unwrap();

    let migration_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM schema_migrations WHERE version = '0001_initial'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(migration_count, 1);
    assert!(!get_all(&connection).unwrap().is_empty());
}

#[test]
fn update_script_targets_the_backend_dataset_directory() {
    let script = include_str!("../../../../package/scripts/update-champions.mjs");

    assert!(script.contains("backend\", \"resources\", \"data\""));
    assert!(script.contains("path.join(backendDatasetDir, \"champions.json\")"));
    assert!(script.contains("path.join(backendDatasetDir, \"dataset-meta.json\")"));
}

#[test]
fn frontend_and_backend_catalogs_are_identical() {
    let backend = include_str!("../../resources/data/champions.json");
    let frontend = include_str!("../../../frontend/public/champions.json");
    assert_eq!(backend, frontend);
}
