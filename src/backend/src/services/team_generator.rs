use std::collections::HashSet;

use rand::{seq::SliceRandom, thread_rng, Rng};

use crate::{
    champion::{Champion, GeneratedTeams, TeamMember},
    error::{AppError, AppResult},
};

const ROLES: [&str; 5] = ["top", "jungle", "mid", "adc", "support"];

pub fn generate(
    champions: &[Champion],
    mode: &str,
    team_count: u8,
    excluded_ids: &[i64],
) -> AppResult<GeneratedTeams> {
    generate_with_rng(champions, mode, team_count, excluded_ids, &mut thread_rng())
}

fn generate_with_rng<R: Rng + ?Sized>(
    champions: &[Champion],
    mode: &str,
    team_count: u8,
    excluded_ids: &[i64],
    rng: &mut R,
) -> AppResult<GeneratedTeams> {
    if !(1..=2).contains(&team_count) {
        return Err(AppError::Validation(
            "El número de equipos debe ser uno o dos.".into(),
        ));
    }

    let excluded: HashSet<_> = excluded_ids.iter().copied().collect();
    let available: Vec<_> = champions
        .iter()
        .filter(|champion| !excluded.contains(&champion.id))
        .cloned()
        .collect();
    match mode {
        "random" => generate_random(&available, team_count, rng),
        "roles" => generate_with_roles(&available, team_count, rng),
        _ => Err(AppError::Validation(
            "Modo de generación no reconocido.".into(),
        )),
    }
}

fn generate_random<R: Rng + ?Sized>(
    champions: &[Champion],
    team_count: u8,
    rng: &mut R,
) -> AppResult<GeneratedTeams> {
    let member_count = team_count as usize * 5;
    if champions.len() < member_count {
        return Err(AppError::Validation(format!(
            "El catálogo necesita al menos {member_count} campeones."
        )));
    }

    let mut selected = champions.to_vec();
    selected.shuffle(rng);
    let members: Vec<_> = selected
        .into_iter()
        .take(member_count)
        .map(|champion| TeamMember {
            champion,
            role: None,
        })
        .collect();
    Ok(GeneratedTeams {
        blue: members[..5].to_vec(),
        red: if team_count == 2 {
            members[5..].to_vec()
        } else {
            Vec::new()
        },
    })
}

fn generate_with_roles<R: Rng + ?Sized>(
    champions: &[Champion],
    team_count: u8,
    rng: &mut R,
) -> AppResult<GeneratedTeams> {
    let member_count = team_count as usize * 5;
    if champions.len() < member_count {
        return Err(AppError::Validation(format!(
            "El pool disponible necesita al menos {member_count} campeones."
        )));
    }

    let slots: Vec<String> = ROLES
        .iter()
        .cycle()
        .take(member_count)
        .map(|role| (*role).to_string())
        .collect();
    let mut assignment = vec![None; slots.len()];
    let mut used = Vec::with_capacity(member_count);
    if !assign_slots(&slots, champions, &mut used, &mut assignment, rng) {
        return Err(AppError::Validation(
            "No existe una combinación válida para cubrir todas las posiciones.".into(),
        ));
    }

    let members: Vec<TeamMember> = assignment
        .into_iter()
        .zip(slots)
        .map(|(champion, role)| TeamMember {
            champion: champion.expect("asignación completa"),
            role: Some(role),
        })
        .collect();
    Ok(GeneratedTeams {
        blue: members[..5].to_vec(),
        red: if team_count == 2 {
            members[5..].to_vec()
        } else {
            Vec::new()
        },
    })
}

fn assign_slots<R: Rng + ?Sized>(
    slots: &[String],
    champions: &[Champion],
    used: &mut Vec<i64>,
    result: &mut [Option<Champion>],
    rng: &mut R,
) -> bool {
    if result.iter().all(Option::is_some) {
        return true;
    }

    let Some((slot_index, _)) = result
        .iter()
        .enumerate()
        .filter(|(_, value)| value.is_none())
        .min_by_key(|(index, _)| {
            champions
                .iter()
                .filter(|champion| {
                    champion.roles.contains(&slots[*index]) && !used.contains(&champion.id)
                })
                .count()
        })
    else {
        return true;
    };

    let role = &slots[slot_index];
    let mut candidates: Vec<_> = champions
        .iter()
        .filter(|champion| champion.roles.contains(role) && !used.contains(&champion.id))
        .cloned()
        .collect();
    candidates.shuffle(rng);
    for champion in candidates {
        used.push(champion.id);
        result[slot_index] = Some(champion);
        if assign_slots(slots, champions, used, result, rng) {
            return true;
        }
        result[slot_index] = None;
        used.pop();
    }
    false
}

#[cfg(test)]
#[path = "../../tests/unit/team_generator.rs"]
mod tests;
