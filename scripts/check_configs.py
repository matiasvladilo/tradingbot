"""Guarda de seguridad: ninguna config del repo puede operar con dinero real.

Falla (exit 1) si alguna config:
- declara dry_run distinto de true,
- trae credenciales de exchange, API o Telegram escritas en el archivo,
- o si existe un archivo de config "live".
Las credenciales de la API/Telegram se inyectan por variables FREQTRADE__* desde .env.
"""

import json
import sys
from pathlib import Path

DEFAULT_DIR = Path(__file__).resolve().parent.parent / "freqtrade" / "user_data"

SECRET_PATHS = [
    ("exchange", "key"),
    ("exchange", "secret"),
    ("exchange", "password"),
    ("exchange", "uid"),
    ("api_server", "password"),
    ("api_server", "jwt_secret_key"),
    ("api_server", "ws_token"),
    ("telegram", "token"),
]


def check_config(path: Path) -> list[str]:
    errors = []
    try:
        cfg = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return [f"{path.name}: no se pudo leer ({exc})"]

    if "dry_run" in cfg and cfg["dry_run"] is not True:
        errors.append(f"{path.name}: dry_run debe ser true")
    for section, key in SECRET_PATHS:
        if cfg.get(section, {}).get(key):
            errors.append(f"{path.name}: {section}.{key} no puede estar en el archivo")
    return errors


def check_dir(directory: Path) -> list[str]:
    configs = sorted(directory.glob("config*.json"))
    errors = []
    if not configs:
        errors.append(f"no hay configs en {directory}")
    for path in configs:
        if "live" in path.name.lower():
            errors.append(f"{path.name}: el modo real no está habilitado en este incremento")
        errors.extend(check_config(path))
    for sim in directory.glob("config.sim*.json"):
        if json.loads(sim.read_text(encoding="utf-8")).get("dry_run") is not True:
            errors.append(f"{sim.name}: debe declarar dry_run: true")
    return errors


def main(argv: list[str]) -> int:
    directory = Path(argv[1]) if len(argv) > 1 else DEFAULT_DIR
    errors = check_dir(directory)
    for err in errors:
        print(f"ERROR {err}")
    if not errors:
        print(f"OK configs de {directory}: solo simulación")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
