use std::{net::IpAddr, sync::Mutex};

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::State;
use url::Url;

use crate::{
    champion::{Champion, GeneratedTeams},
    champion_repository,
    error::AppError,
    team_generator,
};

pub struct Database(pub Mutex<Connection>);

/// Cliente compartido por todos los comandos para reutilizar conexiones TLS/HTTP.
pub struct HttpClient(pub reqwest::Client);

#[derive(Serialize)]
pub struct ApiHealthCheck {
    pub online: bool,
    pub status: Option<u16>,
    pub detail: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRequestResult {
    pub ok: bool,
    pub status: Option<u16>,
    pub status_text: String,
    pub body: String,
    pub error: Option<String>,
}

#[derive(Deserialize)]
struct ApiHealthResponse {
    status: String,
    api: String,
}

fn reachable_api_url(api_url: &str) -> Result<Url, AppError> {
    let mut configured = Url::parse(api_url.trim()).map_err(|_| invalid_api_url())?;
    if configured.scheme() != "https"
        || configured.username() != ""
        || configured.password().is_some()
        || configured.query().is_some()
        || configured.fragment().is_some()
    {
        return Err(invalid_api_url());
    }
    if configured.host_str() == Some("fearless-sync.daring-venus-3030.chatgpt.site") {
        configured
            .set_host(Some("fearless-sync.ivimanhm.chatgpt.site"))
            .map_err(|_| invalid_api_url())?;
    }
    match configured.host() {
        Some(url::Host::Ipv4(address)) if is_private_address(IpAddr::V4(address)) => {
            Err(invalid_api_url())
        }
        Some(url::Host::Ipv6(address)) if is_private_address(IpAddr::V6(address)) => {
            Err(invalid_api_url())
        }
        Some(_) => {
            let normalized_path = configured.path().trim_end_matches('/').to_string();
            configured.set_path(&normalized_path);
            Ok(configured)
        }
        None => Err(invalid_api_url()),
    }
}

fn is_private_address(address: IpAddr) -> bool {
    match address {
        IpAddr::V4(address) => {
            address.is_private()
                || address.is_loopback()
                || address.is_link_local()
                || address.is_unspecified()
                || address.is_broadcast()
        }
        IpAddr::V6(address) => {
            address.is_loopback()
                || address.is_unspecified()
                || address.is_unique_local()
                || address.is_unicast_link_local()
        }
    }
}

fn invalid_api_url() -> AppError {
    AppError::Validation("La URL de la API debe ser HTTPS, pública y no incluir credenciales, consulta ni fragmento.".to_string())
}

fn api_endpoint(api_url: &str, path: &str) -> Result<Url, AppError> {
    let mut base = reachable_api_url(api_url)?;
    let base_path = base.path().trim_end_matches('/');
    base.set_path(&format!("{base_path}{path}"));
    Ok(base)
}

#[tauri::command]
pub async fn check_api_health(
    api_url: String,
    http_client: State<'_, HttpClient>,
) -> Result<ApiHealthCheck, String> {
    let client = http_client.0.clone();
    Ok(check_api_health_with_client(api_url, client).await)
}

async fn check_api_health_with_client(api_url: String, client: reqwest::Client) -> ApiHealthCheck {
    let endpoint = match api_endpoint(&api_url, "/api/health") {
        Ok(endpoint) => endpoint,
        Err(error) => {
            return ApiHealthCheck {
                online: false,
                status: None,
                detail: format!("ERROR\n{error}"),
            }
        }
    };
    let command = format!("curl.exe -sSL --max-time 5 \"{endpoint}\"");
    match client.get(endpoint).send().await {
        Ok(response) => {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|error| format!("Error leyendo la respuesta: {error}"));
            let health = serde_json::from_str::<ApiHealthResponse>(&body).ok();
            let online = status.is_success()
                && health
                    .as_ref()
                    .is_some_and(|value| value.status == "ok" && value.api == "online");
            let formatted_body = serde_json::from_str::<serde_json::Value>(&body)
                .and_then(|value| serde_json::to_string_pretty(&value))
                .unwrap_or(body);
            ApiHealthCheck {
                online,
                status: Some(status.as_u16()),
                detail: format!(
                    "COMANDO USADO\n{command}\n\nRESPUESTA · HTTP {}\n{formatted_body}",
                    status.as_u16()
                ),
            }
        }
        Err(error) => ApiHealthCheck {
            online: false,
            status: None,
            detail: format!("COMANDO USADO\n{command}\n\nERROR\n{error}"),
        },
    }
}

#[tauri::command]
pub async fn fearless_api_request(
    api_url: String,
    method: String,
    path: String,
    body: Option<serde_json::Value>,
    auth_token: Option<String>,
    http_client: State<'_, HttpClient>,
) -> Result<ApiRequestResult, String> {
    let client = http_client.0.clone();
    Ok(fearless_api_request_with_client(api_url, method, path, body, auth_token, client).await)
}

async fn fearless_api_request_with_client(
    api_url: String,
    method: String,
    path: String,
    body: Option<serde_json::Value>,
    auth_token: Option<String>,
    client: reqwest::Client,
) -> ApiRequestResult {
    if !path.starts_with("/api/")
        || !matches!(method.as_str(), "GET" | "POST" | "PATCH" | "PUT" | "DELETE")
    {
        return ApiRequestResult {
            ok: false,
            status: None,
            status_text: String::new(),
            body: String::new(),
            error: Some("Peticion API no permitida.".to_string()),
        };
    }

    let endpoint = match api_endpoint(&api_url, &path) {
        Ok(endpoint) => endpoint,
        Err(error) => {
            return ApiRequestResult {
                ok: false,
                status: None,
                status_text: String::new(),
                body: String::new(),
                error: Some(error.to_string()),
            }
        }
    };
    let mut request = if method == "POST" || method == "PATCH" || method == "PUT" {
        client
            .request(
                match method.as_str() {
                    "PATCH" => reqwest::Method::PATCH,
                    "PUT" => reqwest::Method::PUT,
                    _ => reqwest::Method::POST,
                },
                endpoint,
            )
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .json(&body.unwrap_or(serde_json::Value::Null))
    } else {
        client.request(
            if method == "DELETE" {
                reqwest::Method::DELETE
            } else {
                reqwest::Method::GET
            },
            endpoint,
        )
    };
    request = request.header(reqwest::header::ACCEPT, "application/json");
    if let Some(token) = auth_token.filter(|value| !value.is_empty()) {
        request = request.bearer_auth(token);
    }

    match request.send().await {
        Ok(response) => {
            let status = response.status();
            let status_text = status.canonical_reason().unwrap_or_default().to_string();
            let response_body = response.text().await.unwrap_or_default();
            ApiRequestResult {
                ok: status.is_success(),
                status: Some(status.as_u16()),
                status_text,
                body: response_body,
                error: None,
            }
        }
        Err(error) => ApiRequestResult {
            ok: false,
            status: None,
            status_text: String::new(),
            body: String::new(),
            error: Some(error.to_string()),
        },
    }
}

#[tauri::command]
pub fn get_champions(database: State<'_, Database>) -> Result<Vec<Champion>, String> {
    let connection = database
        .0
        .lock()
        .map_err(|_| command_error(AppError::DatabaseUnavailable))?;
    champion_repository::get_all(&connection).map_err(command_error)
}

#[tauri::command]
pub fn generate_teams(
    mode: String,
    team_count: Option<u8>,
    excluded_champion_ids: Option<Vec<i64>>,
    database: State<'_, Database>,
) -> Result<GeneratedTeams, String> {
    let connection = database
        .0
        .lock()
        .map_err(|_| command_error(AppError::DatabaseUnavailable))?;
    let champions = champion_repository::get_all(&connection).map_err(command_error)?;
    team_generator::generate(
        &champions,
        &mode,
        team_count.unwrap_or(2),
        &excluded_champion_ids.unwrap_or_default(),
    )
    .map_err(command_error)
}

fn command_error(error: AppError) -> String {
    eprintln!("Error en comando Tauri: {error:?}");
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_the_legacy_api_host_and_joins_paths_safely() {
        let endpoint = api_endpoint(
            "https://fearless-sync.daring-venus-3030.chatgpt.site/base/",
            "/api/health",
        )
        .unwrap();
        assert_eq!(
            endpoint.as_str(),
            "https://fearless-sync.ivimanhm.chatgpt.site/base/api/health"
        );
    }

    #[test]
    fn rejects_unsafe_api_urls() {
        for value in [
            "http://example.test",
            "https://user:secret@example.test",
            "https://example.test/?query=value",
            "https://127.0.0.1",
            "https://[::1]",
        ] {
            assert!(reachable_api_url(value).is_err(), "URL accepted: {value}");
        }
    }
}
