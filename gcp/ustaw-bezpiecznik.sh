#!/bin/bash
# Ustawia budżet 1 GBP (waluta konta) (liczony bez środków próbnych) i funkcję, która po przekroczeniu odłącza płatności od projektu.
set -euo pipefail
G="${GCLOUD:-gcloud}"
P=rich-chimera-344319
REGION=us-east1
cd "$(dirname "$0")"

"$G" config set project $P >/dev/null
"$G" services enable billingbudgets.googleapis.com cloudbilling.googleapis.com pubsub.googleapis.com \
  cloudfunctions.googleapis.com cloudbuild.googleapis.com run.googleapis.com eventarc.googleapis.com artifactregistry.googleapis.com

BA=$("$G" billing projects describe $P --format='value(billingAccountName)' | sed 's#billingAccounts/##')
echo "konto rozliczeniowe: $BA"

"$G" pubsub topics describe budzet-stop >/dev/null 2>&1 || "$G" pubsub topics create budzet-stop

# Konto usługi funkcji z prawem odłączania płatności
SA=bezpiecznik@$P.iam.gserviceaccount.com
"$G" iam service-accounts describe $SA >/dev/null 2>&1 || "$G" iam service-accounts create bezpiecznik
"$G" billing accounts add-iam-policy-binding $BA --member=serviceAccount:$SA --role=roles/billing.admin >/dev/null
"$G" projects add-iam-policy-binding $P --member=serviceAccount:$SA --role=roles/billing.projectManager --condition=None >/dev/null

"$G" functions deploy bezpiecznik --gen2 --region=$REGION --runtime=python312 --source=bezpiecznik \
  --entry-point=stop_billing --trigger-topic=budzet-stop --service-account=$SA \
  --set-env-vars=PROJECT_ID=$P --memory=256Mi --max-instances=1 --quiet

if ! "$G" billing budgets list --billing-account=$BA --format='value(displayName)' | grep -qx bezpiecznik; then
  "$G" billing budgets create --billing-account=$BA --display-name=bezpiecznik \
    --budget-amount=1GBP --filter-projects=projects/$P --credit-types-treatment=exclude-all-credits \
    --threshold-rule=percent=0.01 --threshold-rule=percent=0.5 --threshold-rule=percent=1.0 \
    --notifications-rule-pubsub-topic=projects/$P/topics/budzet-stop
fi
echo "GOTOWE"
"$G" compute disks list --format='table(name,zone.basename(),sizeGb,type.basename())'
