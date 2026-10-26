"""Check synthetic pricing documentation arithmetic; not a production quote engine."""
import json
from decimal import Decimal, ROUND_CEILING, ROUND_HALF_UP
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "PRD/docs/pricing/calculation-examples.json").read_text(encoding="utf-8"))


def number(value):
    assert isinstance(value, (str, int)) and not isinstance(value, bool), "Use integers or decimal strings"
    result = Decimal(value)
    assert result.is_finite() and result >= 0, "Missing, negative or non-finite quantity"
    return result


def rounded(value):
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def ceiling(value):
    return value.to_integral_value(rounding=ROUND_CEILING)


def parcel(case):
    divisor, step = number(case["divisor"]), number(case["stepKg"])
    assert divisor > 0 and step > 0
    physical, dimensional, each_max, each_rounded = (Decimal(0) for _ in range(4))
    for piece in case["pieces"]:
        quantity = number(piece["quantity"])
        assert quantity >= 1 and quantity == ceiling(quantity)
        dimensions = [number(piece[key]) for key in ("lengthCm", "widthCm", "heightCm")]
        weight = number(piece["weightKg"])
        assert weight > 0 and all(value > 0 for value in dimensions)
        volume_weight = dimensions[0] * dimensions[1] * dimensions[2] / divisor
        physical += weight * quantity
        dimensional += volume_weight * quantity
        each_max += max(weight, volume_weight) * quantity
        each_rounded += ceiling(max(weight, volume_weight) / step) * step * quantity
    mode = case["aggregation"]
    assert mode in ("PER_PIECE", "PER_SHIPMENT", "TOTAL_MAX")
    if mode == "PER_PIECE":
        billable = each_rounded
    else:
        raw = each_max if mode == "PER_SHIPMENT" else max(physical, dimensional)
        billable = ceiling(raw / step) * step
    unit = number(case["additionalKg"])
    assert unit > 0
    extra_units = ceiling(max(Decimal(0), billable - number(case["firstKg"])) / unit)
    return billable, number(case["firstMinor"]) + extra_units * number(case["additionalMinor"])


def main():
    assert DATA["status"] == "SYNTHETIC_NOT_FOR_PRODUCTION"
    checked = []
    for case in DATA["distance"]:
        assert case["currency"] in ("USD", "KHR")
        extra = max(Decimal(0), number(case["meters"]) - number(case["includedMeters"]))
        assert case["mode"] in ("ACTUAL_METERS", "CEIL_UNIT")
        if case["mode"] == "ACTUAL_METERS":
            fee = rounded(extra * number(case["rateMinorPerKm"]) / 1000)
        else:
            unit = number(case["unitMeters"])
            assert unit > 0
            fee = rounded(ceiling(extra / unit) * number(case["rateMinorPerUnit"]))
        assert fee == case["expectedExtraMinor"], case["id"]
        assert number(case["baseMinor"]) + fee == case["expectedTotalMinor"], case["id"]
        checked.append(case["id"])

    for case in DATA["parcel"]:
        weight, fee = parcel(case)
        assert weight == number(case["expectedBillableKg"]), case["id"]
        assert fee == case["expectedTotalMinor"], case["id"]
        checked.append(case["id"])

    case = DATA["bands"]
    fee, previous = Decimal(0), Decimal(0)
    for band in case["bands"]:
        start, end = number(band["fromMeters"]), number(band["toMeters"])
        assert start == previous and end > start
        fee += max(Decimal(0), min(number(case["extraMeters"]), end) - start) * number(band["rateMinorPerKm"]) / 1000
        previous = end
    assert previous >= number(case["extraMeters"])
    assert rounded(fee) == case["expectedExtraMinor"]
    assert number(case["baseMinor"]) + rounded(fee) == case["expectedTotalMinor"]
    checked.append(case["id"])

    case = DATA["waiting"]
    unit = number(case["unitSeconds"])
    assert unit > 0
    fee = ceiling(max(Decimal(0), number(case["verifiedSeconds"]) - number(case["freeSeconds"])) / unit) * number(case["unitMinor"])
    assert fee == case["expectedMinor"]
    checked.append(case["id"])

    case = DATA["split"]
    basis = number(case["transportMinor"]) - number(case["transportDiscountMinor"])
    rate = number(case["platformBps"])
    assert basis >= 0 and rate <= 10000
    platform = rounded(basis * rate / 10000)
    driver = basis - platform + number(case["driverHandlingMinor"]) + number(case["driverReimbursementMinor"])
    customer = basis + number(case["driverHandlingMinor"]) + number(case["driverReimbursementMinor"]) + number(case["insuranceMinor"])
    assert (basis, platform, driver, customer) == (case["expectedBasisMinor"], case["expectedPlatformMinor"], case["expectedDriverMinor"], case["expectedCustomerServiceMinor"])
    assert platform + driver + number(case["insuranceMinor"]) == customer
    checked.append(case["id"])

    case = DATA["promotion"]
    basis, rate, discount = (number(case[key]) for key in ("agreedSplitBasisMinor", "platformBps", "platformFundedDiscountMinor"))
    assert rate <= 10000 and discount <= basis
    platform = rounded(basis * rate / 10000)
    assert basis - discount == case["expectedCustomerMinor"]
    assert basis - platform == case["expectedDriverMinor"]
    assert platform - discount == case["expectedPlatformAfterDiscountMinor"]
    checked.append(case["id"])

    case = DATA["splitRounding"]
    basis, rate = number(case["basisMinor"]), number(case["platformBps"])
    assert rate <= 10000
    platform = rounded(basis * rate / 10000)
    assert platform == case["expectedPlatformMinor"] and basis - platform == case["expectedDriverMinor"]
    checked.append(case["id"])

    for case in DATA["adjustments"]:
        remainder = number(case["newApprovedQuoteMinor"]) - number(case["netAllocatedMinor"])
        assert max(0, remainder) == case["expectedAdditionalDueMinor"]
        assert max(0, -remainder) == case["expectedRefundReviewMinor"]
        checked.append(case["id"])

    case = DATA["storage"]
    fee = number(case["volumeM3"]) * max(0, number(case["days"]) - number(case["freeDays"])) * number(case["rateMinorPerM3Day"])
    assert rounded(fee) == case["expectedMinor"]
    checked.append(case["id"])

    case = DATA["taxIllustration"]
    tax = rounded(number(case["netMinor"]) * number(case["syntheticRateBps"]) / 10000)
    assert tax == case["expectedTaxMinor"] and number(case["netMinor"]) + tax == case["expectedGrossMinor"]
    checked.append(case["id"])

    for invalid in (None, "", "NaN", "Infinity", -1, 1.5, True):
        try:
            number(invalid)
        except (AssertionError, ArithmeticError):
            pass
        else:
            raise AssertionError("Invalid input accepted")
    assert len(checked) == len(set(checked)) == 20
    print(json.dumps({"status": "PASS", "syntheticArithmeticCases": len(checked), "invalidNumberChecks": 7, "caseIds": checked, "scope": "Documentation arithmetic only; not the runtime quote engine or business acceptance"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
