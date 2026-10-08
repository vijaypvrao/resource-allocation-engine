from datetime import datetime, timedelta
from .models import Location, Resource, Request


def seed_data():
    base = datetime(2026, 10, 6, 9, 0)

    resources = [
        # ---------------------------------------------------------
        # TECH-1
        #
        # The critical resource.
        #
        # Can handle:
        #   - electrical
        #   - security
        #
        # This is intentionally the ONLY resource capable of
        # handling req-2.
        # ---------------------------------------------------------
        Resource(
            "tech-1",
            "Asha",
            Location(12.9716, 77.5946),
            frozenset({"electrical", "security"}),
            base,
            base + timedelta(hours=9)
        ),

        # ---------------------------------------------------------
        # TECH-2
        #
        # Can handle electrical but NOT security.
        #
        # Therefore:
        #   req-1 -> YES
        #   req-2 -> NO
        #
        # It is intentionally farther from req-1 than tech-1.
        # This makes tech-1 the obvious Greedy choice.
        # ---------------------------------------------------------
        Resource(
            "tech-2",
            "Ravi",
            Location(12.9352, 77.6245),
            frozenset({"electrical"}),
            base,
            base + timedelta(hours=9)
        ),

        # ---------------------------------------------------------
        # TECH-3
        #
        # HVAC + Network specialist.
        # ---------------------------------------------------------
        Resource(
            "tech-3",
            "Meera",
            Location(13.0358, 77.5970),
            frozenset({"hvac", "network"}),
            base + timedelta(hours=1),
            base + timedelta(hours=8)
        ),

        # ---------------------------------------------------------
        # TECH-4
        #
        # IMPORTANT:
        # This resource does NOT have electrical/security.
        #
        # This is what creates the real contention between
        # req-1 and req-2.
        # ---------------------------------------------------------
        Resource(
            "tech-4",
            "Arjun",
            Location(12.9141, 77.6411),
            frozenset({"network"}),
            base,
            base + timedelta(hours=9)
        ),

        # ---------------------------------------------------------
        # TECH-5
        #
        # Plumbing + HVAC + Security.
        # ---------------------------------------------------------
        Resource(
            "tech-5",
            "Neha",
            Location(13.0068, 77.5813),
            frozenset({"plumbing", "hvac", "security"}),
            base + timedelta(hours=2),
            base + timedelta(hours=9)
        ),
    ]

    requests = [
        # =========================================================
        # CRITICAL GREEDY VS HUNGARIAN CASE
        # =========================================================

        # ---------------------------------------------------------
        # REQ-1
        #
        # HIGHER priority.
        #
        # Can be served by:
        #   tech-1
        #   tech-2
        #
        # tech-1 is deliberately much closer.
        #
        # Greedy should therefore choose:
        #
        #   req-1 -> tech-1
        #
        # But doing that blocks req-2.
        # ---------------------------------------------------------
        Request(
            "req-1",
            "Office electrical fault",
            Location(12.9650, 77.6000),
            frozenset({"electrical"}),
            base + timedelta(hours=1),
            base + timedelta(hours=3),
            5
        ),

        # ---------------------------------------------------------
        # REQ-2
        #
        # LOWER priority than req-1.
        #
        # Requires BOTH:
        #   electrical
        #   security
        #
        # ONLY tech-1 can satisfy this request.
        #
        # It overlaps req-1.
        #
        # This is the request Greedy should accidentally lose.
        # ---------------------------------------------------------
        Request(
            "req-2",
            "Critical electrical security failure",
            Location(12.9750, 77.5950),
            frozenset({"electrical", "security"}),
            base + timedelta(hours=1),
            base + timedelta(hours=3),
            4
        ),

        # =========================================================
        # HVAC
        # =========================================================

        # tech-3 and tech-5 can handle this.
        Request(
            "req-3",
            "Data-center cooling alert",
            Location(13.0250, 77.6000),
            frozenset({"hvac"}),
            base + timedelta(hours=2),
            base + timedelta(hours=4),
            5
        ),

        # =========================================================
        # NETWORK
        # =========================================================

        # tech-3 and tech-4 can handle this.
        Request(
            "req-4",
            "Branch network outage",
            Location(12.9800, 77.5650),
            frozenset({"network"}),
            base + timedelta(hours=5),
            base + timedelta(hours=6),
            3
        ),

        # =========================================================
        # SECURITY
        # =========================================================

        # tech-1 and tech-5 can handle this.
        #
        # This occurs after req-1/req-2, so tech-1 can potentially
        # become available again in one-to-many mode.
        Request(
            "req-5",
            "Retail security sensor failure",
            Location(13.0000, 77.6200),
            frozenset({"security"}),
            base + timedelta(hours=4),
            base + timedelta(hours=5),
            2
        ),

        # =========================================================
        # SECOND HVAC REQUEST
        # =========================================================

        # Does not overlap req-3.
        #
        # This demonstrates resource reuse in one-to-many mode.
        Request(
            "req-6",
            "HVAC preventive inspection",
            Location(13.0450, 77.5700),
            frozenset({"hvac"}),
            base + timedelta(hours=5),
            base + timedelta(hours=6),
            1
        ),

        # =========================================================
        # SECOND NETWORK REQUEST
        # =========================================================

        # Does not overlap req-4.
        #
        # This demonstrates that the same network resource can
        # serve multiple requests in one-to-many mode.
        Request(
            "req-7",
            "Network equipment health check",
            Location(13.0200, 77.5750),
            frozenset({"network"}),
            base + timedelta(hours=6),
            base + timedelta(hours=7),
            1
        ),
    ]

    return resources, requests