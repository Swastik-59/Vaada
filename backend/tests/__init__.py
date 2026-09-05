import os

# Unit tests own their ephemeral SQLite schema explicitly; deployed services do not.
os.environ.setdefault("VAADA_AUTO_CREATE_SCHEMA", "true")
