use thiserror::Error;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("No se pudo acceder a la base de datos.")]
    Database(#[from] rusqlite::Error),
    #[error("El catálogo incluido no es válido.")]
    Dataset(#[from] serde_json::Error),
    #[error("No se pudo acceder a los datos de la aplicación.")]
    Io(#[from] std::io::Error),
    #[error("La base de datos está ocupada. Inténtalo de nuevo.")]
    DatabaseUnavailable,
    #[error("{0}")]
    Validation(String),
}
