import json
from pathlib import Path


class VisitorManager:

    def __init__(self):
        self.visitors_dir = (
            Path(__file__).resolve().parent.parent / "visitors"
        )

        self.visitors_dir.mkdir(exist_ok=True)

    def create_visitor(self, profile: dict):

        visitor_id = profile["visitor_id"]

        visitor_file = self.visitors_dir / f"{visitor_id}.json"

        with open(visitor_file, "w", encoding="utf-8") as file:
            json.dump(
                profile,
                file,
                indent=4,
                ensure_ascii=False
            )

        return visitor_id

    def get_visitor(self, visitor_id: str):

        visitor_file = self.visitors_dir / f"{visitor_id}.json"

        if not visitor_file.exists():
            return None

        with open(visitor_file, "r", encoding="utf-8") as file:
            return json.load(file)