# Bezpiecznik kosztów: gdy budżet zgłosi koszt powyżej limitu, odłącza płatności od projektu
# (oficjalny wzorzec Google "cap costs"). Serwer staje, ale nic więcej nie może zostać naliczone.
import base64, json, os
import functions_framework
from googleapiclient import discovery

PROJECT = os.environ["PROJECT_ID"]

@functions_framework.cloud_event
def stop_billing(event):
    data = json.loads(base64.b64decode(event.data["message"]["data"]).decode())
    cost, budget = data.get("costAmount", 0), data.get("budgetAmount", 0)
    print(f"koszt={cost} budżet={budget}")
    if cost < 0.01:  # wyłączamy przy pierwszym cencie kosztu (bez środków próbnych), nie przy pełnym budżecie
        return
    billing = discovery.build("cloudbilling", "v1", cache_discovery=False)
    name = f"projects/{PROJECT}"
    if billing.projects().getBillingInfo(name=name).execute().get("billingEnabled"):
        billing.projects().updateBillingInfo(name=name, body={"billingAccountName": ""}).execute()
        print("Płatności odłączone od projektu.")
