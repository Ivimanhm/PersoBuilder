use rand::{rngs::StdRng, SeedableRng};

use super::*;

fn champion(id: i64, roles: &[&str]) -> Champion {
    Champion {
        id,
        name: format!("C{id}"),
        roles: roles.iter().map(|role| (*role).into()).collect(),
        image: String::new(),
    }
}

#[test]
fn role_generation_assigns_unique_valid_champions() {
    let mut champions = Vec::new();
    for (index, role) in ROLES.iter().enumerate() {
        champions.push(champion(index as i64, &[*role]));
        champions.push(champion(index as i64 + 10, &[*role]));
    }
    let teams = generate_with_roles(&champions, 2, &mut StdRng::seed_from_u64(1)).unwrap();
    let members: Vec<_> = teams.blue.iter().chain(&teams.red).collect();
    let mut ids: Vec<_> = members.iter().map(|member| member.champion.id).collect();
    ids.sort_unstable();
    ids.dedup();
    assert_eq!(ids.len(), 10);
    assert!(members.iter().all(|member| member
        .champion
        .roles
        .contains(member.role.as_ref().unwrap())));
}

#[test]
fn reports_when_a_role_cannot_be_filled() {
    let champions = (0..10).map(|id| champion(id, &["top"])).collect::<Vec<_>>();
    assert!(generate_with_roles(&champions, 2, &mut StdRng::seed_from_u64(2)).is_err());
}

#[test]
fn excluded_champions_are_never_selected() {
    let mut champions = Vec::new();
    for (index, role) in ROLES.iter().enumerate() {
        champions.push(champion(index as i64, &[*role]));
        champions.push(champion(index as i64 + 10, &[*role]));
        champions.push(champion(index as i64 + 20, &[*role]));
    }
    let excluded = vec![0, 1, 2, 3, 4];
    let teams = generate_with_rng(
        &champions,
        "roles",
        2,
        &excluded,
        &mut StdRng::seed_from_u64(3),
    )
    .unwrap();
    assert!(teams
        .blue
        .iter()
        .chain(&teams.red)
        .all(|member| !excluded.contains(&member.champion.id)));
}

#[test]
fn backtracking_resolves_a_multirole_assignment_globally() {
    let mut champions = vec![
        champion(1, &["top"]),
        champion(2, &["top", "mid"]),
        champion(3, &["top", "mid"]),
        champion(4, &["mid"]),
    ];
    for (offset, role) in ["jungle", "adc", "support"].iter().enumerate() {
        champions.push(champion(10 + offset as i64, &[*role]));
        champions.push(champion(20 + offset as i64, &[*role]));
    }

    let teams = generate_with_roles(&champions, 2, &mut StdRng::seed_from_u64(4)).unwrap();
    let members: Vec<_> = teams.blue.iter().chain(&teams.red).collect();
    assert_eq!(members.len(), 10);
    assert!(members.iter().all(|member| member
        .champion
        .roles
        .contains(member.role.as_ref().unwrap())));
}

#[test]
fn one_team_contains_exactly_five_champions() {
    let champions = (0..8).map(|id| champion(id, &ROLES)).collect::<Vec<_>>();
    let teams =
        generate_with_rng(&champions, "random", 1, &[], &mut StdRng::seed_from_u64(5)).unwrap();
    assert_eq!(teams.blue.len(), 5);
    assert!(teams.red.is_empty());
}

#[test]
fn rejects_an_invalid_team_count() {
    let champions = (0..10).map(|id| champion(id, &ROLES)).collect::<Vec<_>>();
    assert!(
        generate_with_rng(&champions, "random", 3, &[], &mut StdRng::seed_from_u64(6)).is_err()
    );
}

#[test]
fn rejects_an_unknown_generation_mode() {
    let champions = (0..10).map(|id| champion(id, &ROLES)).collect::<Vec<_>>();
    assert!(
        generate_with_rng(&champions, "invalid", 2, &[], &mut StdRng::seed_from_u64(6)).is_err()
    );
}

#[test]
fn duplicate_exclusions_do_not_change_the_available_pool() {
    let champions = (0..15).map(|id| champion(id, &ROLES)).collect::<Vec<_>>();
    let teams = generate_with_rng(
        &champions,
        "random",
        2,
        &[0, 0, 1, 1],
        &mut StdRng::seed_from_u64(7),
    )
    .unwrap();
    assert!(teams
        .blue
        .iter()
        .chain(&teams.red)
        .all(|member| member.champion.id > 1));
}
