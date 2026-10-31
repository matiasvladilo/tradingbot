import json

from check_configs import DEFAULT_DIR, check_dir


def write(directory, name, data):
    (directory / name).write_text(json.dumps(data), encoding="utf-8")


def test_repo_configs_are_simulation_only():
    assert check_dir(DEFAULT_DIR) == []


def test_rejects_dry_run_false(tmp_path):
    write(tmp_path, "config.sim.json", {"dry_run": False})
    assert any("dry_run" in e for e in check_dir(tmp_path))


def test_rejects_secrets_in_file(tmp_path):
    write(tmp_path, "config.sim.json", {"dry_run": True, "exchange": {"key": "abc", "secret": "x"}})
    errors = check_dir(tmp_path)
    assert any("exchange.key" in e for e in errors)
    assert any("exchange.secret" in e for e in errors)


def test_rejects_live_config(tmp_path):
    write(tmp_path, "config.sim.json", {"dry_run": True})
    write(tmp_path, "config.live.json", {"dry_run": True})
    assert any("modo real" in e for e in check_dir(tmp_path))


def test_accepts_clean_sim(tmp_path):
    write(tmp_path, "config.base.json", {"exchange": {"key": "", "secret": ""}})
    write(tmp_path, "config.sim.json", {"dry_run": True})
    assert check_dir(tmp_path) == []
