# Rihat Alsham launch compliance record

Last reviewed: 2026-09-07

This is the working compliance record for the mobile ordering service. It is
based on the application code and the official Saudi regulator material linked
below. It records facts, open decisions, and evidence; it does not invent a
business fact that has not been verified.

## Current launch decision

The app is not ready to publish its legal pages or accept production orders.
The legal routes intentionally return HTTP 503 while required business details
contain `TODO_` values. This prevents a deployment from exposing placeholders.

The remaining launch gates are:

1. Verify the registered business identity and VAT status.
2. Decide how every app order receives a ZATCA-compliant invoice.
3. complete and record the PDPL basis and safeguards for transfers to Railway
   in Amsterdam and Google infrastructure outside Saudi Arabia.
4. Set exact retention periods and make deletion behavior match them.
5. Record the licence or ownership evidence for every menu image.
6. Complete end-to-end production tests for sign-in, ordering, payment,
   cancellation, refund, account deletion, and invoice delivery.

## Facts confirmed from the implementation

| Area | Confirmed behavior | Evidence |
| --- | --- | --- |
| Customer data | Phone, optional name/email, addresses and coordinates, orders, chat messages/media, push token, and limited payment metadata are stored. | Database schema and API routes |
| Payment cards | Card details are tokenized by Moyasar; the API stores gateway response data including last four digits and brand. | `packages/api/src/routes/payments.ts` |
| Analytics | The admin has sales analytics computed from first-party order records. No customer analytics or advertising SDK is initialized in the mobile code. | Dependency and source audit |
| Hosting | API and PostgreSQL currently run in Railway's Amsterdam region. | Live Railway deployment metadata |
| Firebase | Firebase Authentication provides phone, Google, and Apple authentication; Expo notifications use Firebase Cloud Messaging underneath on Android. | Mobile and API authentication code |
| Account deletion | Saved addresses, loyalty history, chat content/media, identifiers, OTP records, and order notes are removed; the order and payment rows remain anonymized for financial records. Firebase account removal is attempted after the database transaction. | `packages/api/src/routes/users.ts` |
| Invoicing | The app stores orders and payments but has no tax-invoice number, VAT breakdown, XML, cryptographic stamp, ZATCA reporting, invoice PDF, or customer invoice screen. | Database, API, and mobile audit |
| Legal publication | Public legal routes exist in source but are absent from the current live API. The source now blocks them while placeholders remain. | Live HTTP check and route guard |

## Business facts required from the owner

Copy these values exactly from official records. Do not type them from memory.

| Item | Required answer/evidence | Why it is needed |
| --- | --- | --- |
| Registered name | Exact Arabic name and, if present, English name on the commercial record | Controller and seller identity |
| Commercial registration | CR or unified national number and a current record extract | Legal pages and commerce disclosure |
| VAT status | Registered or not registered; if registered, the 15-digit VAT number and certificate | Pricing text, checkout, invoices, and verification |
| Support contact | A monitored email address and the person responsible for answering it | Privacy rights, complaints, refunds, and store listing |
| POS/invoice system | Provider name, whether it prints a QR invoice, and how app orders reach it | Determines whether to integrate an existing invoice or build a compliant connector |
| ZATCA Phase 2 | Whether ZATCA sent the business an integration-wave notice and its deadline | Determines the technical invoice obligations and schedule |
| Revenue band | Below SAR 187,500; SAR 187,500–375,000; or above SAR 375,000 annual taxable revenue | Helps verify VAT registration and Phase 2 applicability without collecting an exact revenue figure |
| Dish images | Source and licence/ownership proof for each image | Commercial copyright evidence |

## VAT and invoices

Do not publish the sentence “all prices include 15% VAT” until VAT registration
is confirmed. ZATCA states that mandatory VAT registration generally begins
above SAR 375,000 in annual taxable supplies, with voluntary registration from
SAR 187,500. A VAT-registered restaurant should display VAT-inclusive consumer
prices and retain the required accounting records.

The first technical question is whether the restaurant's current POS already
creates a compliant simplified tax invoice for app orders. If it does, the app
should send the order to that system and return its invoice number, QR code, and
customer copy. Building a second tax engine would add cost and reconciliation
risk. If the POS does not cover app orders, a ZATCA-compliant invoicing provider
or integration is required. A QR image alone is not Phase 2 compliance: the
solution can also require prescribed XML, UUIDs, tamper controls, cryptographic
stamps, and reporting of simplified invoices.

Paid order, payment, and invoice records should be retained for six years when
the business is subject to the ordinary VAT record-retention rule. Personal
fields that are unnecessary for that record should be deleted or anonymized
when the account is deleted or their operational purpose ends.

## PDPL work plan

The privacy policy must identify the controller, purposes and legal bases,
categories collected, recipients, geographic processing locations, retention
periods, rights and how to exercise them, and the complaint route. The current
draft still needs exact retention periods and a verified contact address.

For each external processor, record:

| Processor | Data/purpose | Current location | Required evidence before launch |
| --- | --- | --- | --- |
| Railway | Account, address, order, chat, and payment metadata; API/database hosting | Amsterdam, Netherlands | Contract/DPA, subprocessor list, security evidence, transfer basis, and Saudi-required safeguard or approved exception |
| Google Firebase | Identity, phone verification, social sign-in, and push infrastructure | Firebase Authentication: United States; Cloud Messaging: global Google infrastructure | Applicable product terms/DPA, data settings, transfer basis, and safeguard or approved exception |
| Moyasar | Payment and transaction data | Confirm from the merchant agreement | Merchant agreement/DPA, retention, location, and incident contact |

Customer acknowledgement is not itself a substitute for the conditions and
safeguards required for an overseas transfer. Complete a transfer risk
assessment using SDAIA's official template and document the applicable route,
such as adequacy, Saudi Standard Contractual Clauses, Binding Corporate Rules,
accreditation, or a narrowly applicable regulatory exception. If a provider
will not support the necessary arrangement, replace that provider or move the
affected workload.

Operational records still needed:

- processing-activity register covering each data category and recipient;
- privacy impact assessment for the public ordering service;
- transfer risk assessment for each overseas recipient;
- processor contracts and subprocessor evidence;
- rights-request log and response procedure;
- breach-response procedure that can meet the applicable 72-hour notification
  window when an incident may harm personal data or its owner;
- deletion and retention schedule with a responsible owner.

## Image evidence

Create an asset register with one row per dish image: filename, dish, source,
photographer/designer, date received, licence terms, original file, and proof.
Replace any image whose source cannot be proven. Photos taken by the restaurant
should still have a written assignment or permission if a freelancer or agency
took them.

## Official sources

- [Saudi PDPL portal and knowledge centre](https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/)
- [SDAIA privacy-policy guideline](https://dgp.sdaia.gov.sa/wps/wcm/connect/3125da48-43dd-46bc-9156-1f7b91ab8f54/Elaboration%2Band%2BDeveloping%2BPrivacy%2BPolicy%2BGuideline.pdf?MOD=AJPERES)
- [SDAIA transfer regulation](https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/details/PDPL2/)
- [SDAIA transfer risk-assessment guideline](https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/details/RiskAssessmentGuideline%20orTransferringPersonalData)
- [ZATCA VAT registration](https://zatca.gov.sa/en/eServices/Pages/eServices-002.aspx)
- [ZATCA e-invoicing preparation](https://zatca.gov.sa/en/E-Invoicing/PreparingYourBusiness/Phase1/Pages/How-to-prepare.aspx)
- [ZATCA e-invoicing FAQ](https://www.zatca.gov.sa/en/E-Invoicing/Documents/Einvoicing_FAQ_EN.pdf)
- [Ministry of Commerce e-commerce law](https://mc.gov.sa/ar/ECC/pages/default.aspx)
- [Railway deployment regions](https://docs.railway.com/deployments/regions)
- [Railway data processing agreement](https://railway.com/legal/dpa)
