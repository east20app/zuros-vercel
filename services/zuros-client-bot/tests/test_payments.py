from zuros_client.cogs.commerce import payment_state


def test_payment_state_detects_purchase_and_renewal_confirmation() -> None:
    assert payment_state({"status": "opened", "step": "payment-confirmed"}) == "approved"
    assert payment_state({"status": "closed", "step": "payment-confirmed"}) == "approved"


def test_payment_state_keeps_waiting_and_detects_terminal_states() -> None:
    assert payment_state({"status": "opened", "step": "waiting-payment"}) == "pending"
    assert payment_state({"status": "expired", "step": "waiting-payment"}) == "terminal"
