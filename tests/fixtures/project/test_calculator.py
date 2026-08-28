"""Covers `add` and the happy path of `divide`, but not its raise."""

import unittest

from calculator import add, divide


class CalculatorTest(unittest.TestCase):
    def test_add(self):
        self.assertEqual(add(2, 3), 5)

    def test_divide(self):
        self.assertEqual(divide(6, 3), 2)


if __name__ == "__main__":
    unittest.main()
