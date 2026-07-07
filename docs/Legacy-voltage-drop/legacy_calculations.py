from __future__ import annotations

from math import sqrt


TEMP_FACTORS = {
    10: 1.22,
    15: 1.17,
    20: 1.12,
    25: 1.06,
    30: 1.0,
    35: 0.94,
    40: 0.87,
    45: 0.79,
    50: 0.71,
    55: 0.61,
    60: 0.5,
}

GROUP_FACTORS = {
    "1": 1.0,
    "2": 0.95,
    "3": 0.9,
    "4-6": 0.88,
    "7-9": 0.84,
    "10-12": 0.78,
    "13-15": 0.65,
    "16-20": 0.57,
}

COPPER_OVERHEAD = {
    "1.5": 19, "2.5": 26, "4": 34, "6": 44, "10": 61, "16": 82,
    "25": 109, "35": 135, "50": 165, "70": 210, "95": 250,
    "120": 285, "150": 320, "185": 355, "240": 415, "300": 470,
    "2120": 570, "2150": 640, "2185": 710, "2240": 830, "2300": 940,
    "3120": 855, "3150": 960, "3185": 1065, "3240": 1245, "3300": 1410,
    "4120": 1140, "4150": 1280, "4185": 1420, "4240": 1660, "4300": 1880,
}

COPPER_UNDERGROUND = {
    "1.5": 27, "2.5": 36, "4": 47, "6": 59, "10": 79, "16": 102,
    "25": 133, "35": 159, "50": 188, "70": 232, "95": 280,
    "120": 318, "150": 359, "185": 406, "240": 473, "300": 535,
    "2120": 636, "2150": 718, "2185": 812, "2240": 946, "2300": 1070,
    "3120": 954, "3150": 1077, "3185": 1218, "3240": 1419, "3300": 1605,
    "4120": 1272, "4150": 1436, "4185": 1624, "4240": 1892, "4300": 2140,
}

ALUMINUM_OVERHEAD = {
    "10": 46, "16": 61, "25": 79, "35": 98, "50": 116, "70": 146,
    "95": 176, "120": 202, "150": 226, "185": 255, "240": 292, "300": 330,
    "2120": 404, "2150": 452, "2185": 510, "2240": 584, "2300": 660,
    "3120": 606, "3150": 678, "3185": 765, "3240": 876, "3300": 990,
    "4120": 808, "4150": 904, "4185": 1020, "4240": 1168, "4300": 1320,
}

ALUMINUM_UNDERGROUND = {
    "10": 46, "16": 70, "25": 99, "35": 118, "50": 142, "70": 176,
    "95": 211, "120": 242, "150": 270, "185": 308, "240": 363, "300": 412,
    "2120": 484, "2150": 540, "2185": 616, "2240": 726, "2300": 824,
    "3120": 726, "3150": 810, "3185": 924, "3240": 1089, "3300": 1236,
    "4120": 968, "4150": 1080, "4185": 1232, "4240": 1452, "4300": 1648,
}


def section_key(section: float | int | str) -> str:
    value = float(str(section).replace(",", "."))
    return str(int(value)) if value.is_integer() else str(value)


def temperature_factor(temperature: float | int | str) -> float:
    text = "".join(ch for ch in str(temperature) if ch.isdigit() or ch in ",.-")
    return TEMP_FACTORS.get(int(float(text)), 1.0)


def capacity_table(conductor: str, installation: str) -> dict[str, int]:
    if conductor == "copper":
        return COPPER_UNDERGROUND if installation == "underground" else COPPER_OVERHEAD
    if conductor == "aluminum":
        return ALUMINUM_UNDERGROUND if installation == "underground" else ALUMINUM_OVERHEAD
    raise ValueError(f"unknown conductor: {conductor}")


def conductivity(conductor: str) -> int:
    return 56 if conductor == "copper" else 35


def calculate_segment(
    *,
    power_kw: float,
    distance_m: float,
    voltage_v: float,
    cosphi: float,
    conductor: str,
    installation: str,
    temperature: float | int | str,
    cable_count: str,
    section: float | int | str,
    voltage_type: str,
) -> dict[str, float | str]:
    key = section_key(section)
    ampacity = capacity_table(conductor, installation).get(key)
    if ampacity is None:
        raise ValueError(f"section {key} is not defined for {conductor}/{installation}")

    kt = temperature_factor(temperature)
    kg = GROUP_FACTORS.get(str(cable_count), 1.0)
    allowed_current = ampacity * kt * kg

    power_w = power_kw * 1000
    k = conductivity(conductor)

    if voltage_type == "three":
        voltage_drop_percent = (100 * power_w * distance_m) / (k * float(section) * voltage_v**2)
        current_a = power_w / (sqrt(3) * voltage_v * cosphi)
    else:
        voltage_drop_percent = (200 * power_w * distance_m) / (k * float(section) * voltage_v**2)
        current_a = power_w / (voltage_v * cosphi)

    return {
        "section_key": key,
        "ampacity_a": ampacity,
        "allowed_current_a": allowed_current,
        "current_a": current_a,
        "voltage_drop_percent": voltage_drop_percent,
    }


def evaluate_segment(
    *,
    power_kw: float,
    distance_m: float,
    voltage_v: float,
    cosphi: float,
    conductor: str,
    installation: str,
    temperature: float | int | str,
    cable_count: str,
    section: float | int | str,
    voltage_type: str,
    voltage_drop_limit_percent: float,
) -> dict[str, float | str | bool]:
    result = calculate_segment(
        power_kw=power_kw,
        distance_m=distance_m,
        voltage_v=voltage_v,
        cosphi=cosphi,
        conductor=conductor,
        installation=installation,
        temperature=temperature,
        cable_count=cable_count,
        section=section,
        voltage_type=voltage_type,
    )
    voltage_drop_ok = result["voltage_drop_percent"] <= voltage_drop_limit_percent
    thermal_ok = result["current_a"] <= result["allowed_current_a"]

    return {
        **result,
        "voltage_drop_limit_percent": voltage_drop_limit_percent,
        "voltage_drop_ok": voltage_drop_ok,
        "thermal_ok": thermal_ok,
        "section_suitable": voltage_drop_ok and thermal_ok,
        "voltage_drop_status": "voltage_drop_ok" if voltage_drop_ok else "voltage_drop_exceeded",
        "thermal_status": "thermal_ok" if thermal_ok else "thermal_failed",
    }


def evaluate_project(
    segments: list[dict[str, float | int | str]],
    *,
    total_voltage_drop_limit_percent: float,
) -> dict[str, float | bool | list[dict[str, float | str | bool]]]:
    segment_results = [
        evaluate_segment(
            power_kw=float(segment["power_kw"]),
            distance_m=float(segment["distance_m"]),
            voltage_v=float(segment["voltage_v"]),
            cosphi=float(segment["cosphi"]),
            conductor=str(segment["conductor"]),
            installation=str(segment["installation"]),
            temperature=segment["temperature"],
            cable_count=str(segment["cable_count"]),
            section=segment["section"],
            voltage_type=str(segment["voltage_type"]),
            voltage_drop_limit_percent=float(segment["voltage_drop_limit_percent"]),
        )
        for segment in segments
    ]
    total_voltage_drop = sum(float(item["voltage_drop_percent"]) for item in segment_results)
    highest_current = max((float(item["current_a"]) for item in segment_results), default=0.0)
    total_voltage_drop_ok = total_voltage_drop <= total_voltage_drop_limit_percent

    return {
        "segments": segment_results,
        "total_voltage_drop_percent": total_voltage_drop,
        "highest_current_a": highest_current,
        "total_voltage_drop_limit_percent": total_voltage_drop_limit_percent,
        "total_voltage_drop_ok": total_voltage_drop_ok,
        "total_voltage_drop_status": (
            "total_voltage_drop_ok" if total_voltage_drop_ok else "total_voltage_drop_exceeded"
        ),
        "all_sections_suitable": all(bool(item["section_suitable"]) for item in segment_results),
    }
