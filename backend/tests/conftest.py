from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIRECTORY = (
    Path(__file__).resolve().parents[1]
)

ENV_FILE = BACKEND_DIRECTORY / ".env"

load_dotenv(
    dotenv_path=ENV_FILE,
    override=False,
)