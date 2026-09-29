// MSVC imprime la creación de la biblioteca de importación en stdout; Rust la
// reporta como linker_messages aunque sea solo un mensaje de progreso.
#![cfg_attr(target_os = "windows", allow(linker_messages))]

#[path = "domain/champion.rs"]
mod champion;
#[path = "infrastructure/persistence/champion_repository.rs"]
mod champion_repository;
#[path = "application/commands.rs"]
mod commands;
#[path = "support/error.rs"]
mod error;
#[path = "services/team_generator.rs"]
mod team_generator;

use std::fs;

use commands::{Database, HttpClient};
use rusqlite::Connection;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if let Err(error) = tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&data_dir)?;
            let mut connection = Connection::open(data_dir.join("draftlab.db"))?;
            champion_repository::initialize(&mut connection).map_err(std::io::Error::other)?;
            let http_client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(5))
                .redirect(reqwest::redirect::Policy::none())
                .cookie_store(true)
                .user_agent("PersoBuilder/1.0")
                .build()
                .map_err(std::io::Error::other)?;
            app.manage(Database(std::sync::Mutex::new(connection)));
            app.manage(HttpClient(http_client));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_champions,
            commands::generate_teams,
            commands::check_api_health,
            commands::fearless_api_request
        ])
        .run(tauri::generate_context!())
    {
        eprintln!("No se pudo iniciar Perso Builder: {error}");
    }
}
