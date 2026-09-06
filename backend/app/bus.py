from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Deque


@dataclass
class Event:
    t: str
    key: str
    summary: str
    topic: str


@dataclass
class Topic:
    name: str
    retain: int = 18
    log: Deque[Event] = field(init=False)
    count: int = 0

    def __post_init__(self) -> None:
        self.log = deque(maxlen=self.retain)

    def publish(self, event: Event) -> None:
        self.log.append(event)
        self.count += 1


class Bus:
    """In-process Kafka-style log. Production swaps this for Kafka / Kinesis."""

    def __init__(self) -> None:
        self.topics = {
            "rpm.vitals.raw": Topic("rpm.vitals.raw", retain=14),
            "rpm.features.windowed": Topic("rpm.features.windowed", retain=12),
            "rpm.anomalies.scores": Topic("rpm.anomalies.scores", retain=12),
            "rpm.fhir.tasks": Topic("rpm.fhir.tasks", retain=10),
        }

    def publish(self, topic: str, t: str, key: str, summary: str) -> None:
        self.topics[topic].publish(Event(t=t, key=key, summary=summary, topic=topic))
