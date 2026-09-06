from __future__ import annotations

from typing import Any


def build_task(
    *,
    task_id: str,
    patient_id: str,
    patient_name: str,
    mrn: str,
    bed: str,
    authored_on: str,
    kind: str,
    priority: str,
    description: str,
    aura: int,
    hrv: float,
    temp: float,
    hr: int,
    spo2: int,
    intersecting: bool,
    if_score: float,
    news2: int,
) -> dict[str, Any]:
    if kind == "sepsis":
        coding = {
            "system": "http://snomed.info/sct",
            "code": "91302008",
            "display": "Sepsis",
        }
        text = "Early warning: suspected sepsis / physiological deterioration"
    elif kind == "cardiac":
        coding = {
            "system": "http://snomed.info/sct",
            "code": "410429000",
            "display": "Cardiac arrest (finding)",
        }
        text = "Early warning: suspected cardiac deterioration"
    else:
        coding = {
            "system": "http://snomed.info/sct",
            "code": "389086002",
            "display": "Hypoxia",
        }
        text = "Early warning: suspected hypoxemic deterioration"

    return {
        "resourceType": "Task",
        "id": task_id,
        "meta": {
            "profile": ["http://hl7.org/fhir/uv/bpmn/StructureDefinition/task"],
            "source": "AURA Isolation Forest · rpm.anomalies.scores",
        },
        "identifier": [
            {
                "system": "https://aura.clinical/fhir/task",
                "value": task_id.upper(),
            }
        ],
        "basedOn": [{"reference": f"Patient/{patient_id}", "display": patient_name}],
        "status": "requested",
        "intent": "order",
        "priority": priority,
        "code": {"coding": [coding], "text": text},
        "description": description,
        "for": {
            "reference": f"Patient/{patient_id}",
            "identifier": {
                "system": "http://hospital.example/mrn",
                "value": mrn,
            },
            "display": f"{patient_name} · {bed}",
        },
        "authoredOn": authored_on,
        "lastModified": authored_on,
        "requester": {
            "display": "AURA Clinical RPM · time-series anomaly service",
        },
        "owner": {"display": "4W Charge Nurse"},
        "input": [
            {"type": {"text": "AURA score"}, "valueInteger": aura},
            {
                "type": {"text": "Isolation Forest anomaly score"},
                "valueDecimal": round(if_score, 3),
            },
            {"type": {"text": "NEWS2"}, "valueInteger": news2},
            {
                "type": {"coding": [{"system": "http://loinc.org", "code": "80439-3"}]},
                "valueQuantity": {"value": hrv, "unit": "ms", "code": "ms"},
            },
            {
                "type": {"coding": [{"system": "http://loinc.org", "code": "8310-5"}]},
                "valueQuantity": {"value": temp, "unit": "Cel", "code": "Cel"},
            },
            {
                "type": {"coding": [{"system": "http://loinc.org", "code": "8867-4"}]},
                "valueQuantity": {"value": hr, "unit": "/min", "code": "/min"},
            },
            {
                "type": {"coding": [{"system": "http://loinc.org", "code": "2708-6"}]},
                "valueQuantity": {"value": spo2, "unit": "%", "code": "%"},
            },
            {
                "type": {"text": "HRV × temperature intersection"},
                "valueBoolean": intersecting,
            },
        ],
    }
