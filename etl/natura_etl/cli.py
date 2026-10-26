import argparse
import json
import logging
import sys
from pathlib import Path

from . import config, pipeline


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="natura_etl", description="Load Natura 2000 Greece into SQLite")
    parser.add_argument("--db", type=Path, default=config.DB_PATH, help="SQLite file (default: %(default)s)")
    parser.add_argument("--use-cache", action="store_true",
                        help="reuse downloads in the raw cache directory instead of fetching again")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)-7s %(message)s")
    summary = pipeline.run(args.db, use_cache=args.use_cache)
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
