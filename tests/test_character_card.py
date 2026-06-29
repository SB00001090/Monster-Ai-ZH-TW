import json

from monster_ai.modules.roleplay.character_card import CharacterCard, parse_card_json


def test_parse_v2_card():
    raw = {
        "name": "Luna",
        "description": "A forest guide",
        "personality": "Wise and calm",
        "scenario": "Ancient woods",
        "first_mes": "Welcome, traveler.",
        "mes_example": "<START>",
    }
    card = parse_card_json(raw)
    assert card.name == "Luna"
    assert "forest guide" in card.build_system_prompt()


def test_nested_data_field():
    inner = {"name": "Kai", "description": "Pilot"}
    card = parse_card_json({"data": inner})
    assert card.name == "Kai"