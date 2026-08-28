"""A tiny module for the integration test to measure, with one uncovered branch."""


def add(a, b):
    """Returns the sum of `a` and `b`."""
    return a + b


def divide(a, b):
    """Returns `a` divided by `b`.

    :raises ZeroDivisionError: when `b` is zero. Deliberately left untested, so
        the report the integration test reads has a missing line in it.
    """
    if b == 0:
        raise ZeroDivisionError("division by zero")
    return a / b
