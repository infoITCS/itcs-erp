# Customer Registration Field Specification

## Design Rules

- `entity_type` answers who the customer legally is (`COMPANY` or `INDIVIDUAL`). `customer_type` remains the commercial segment (B2B, B2C or wholesale); the legacy COMPANY/INDIVIDUAL values remain accepted for existing records.
- Customer numbers are allocated by the backend. They are displayed as read-only guidance and are never accepted from the client.
- Address fields are stored as repeatable address records with a `purpose` of BILLING or SHIPPING. The customer-level `same_as_billing` flag defaults to true; switching it on removes separate shipping rows from the submitted address set.
- Optional references (payment terms, price family and tax group) must belong to the signed-in organization and be active.
- Marketing consent defaults to false. It must only be enabled after affirmative consent is received.
- `opening_balance` is a migration/go-live starting amount, not a calculated outstanding receivable. The current schema has no invoice/payment ledger calculation.
- `identity_document_number` is sensitive personal data. Restrict production access, mask it in non-edit views, and apply the deployment's encryption-at-rest/key-management policy before production use.

## Field Matrix

| Section | Field label | System name (snake_case; API path where nested) | Data type / UI | Required | Validation | Purpose |
|---|---|---|---|---|---|---|
| Overview | Entity type | `entity_type` | Enum; segmented Company/Individual | Yes | `COMPANY` or `INDIVIDUAL` | Legal person classification; drives conditional fields. |
| Overview | Customer / full name | `display_name` | String; text input | Yes | Trimmed, 1-200 characters | Name used in CRM lists and documents. For individuals this is also sent as legal name. |
| Overview | Registered legal name | `legal_name` | String; text input | Company only | Trimmed, 1-200 characters | Company's formal registered name. |
| Overview | Customer segment | `customer_type` | Enum; dropdown | Yes | B2B, B2C, WHOLESALE; legacy COMPANY/INDIVIDUAL accepted | Commercial selling segment, separate from entity type. |
| Overview | Customer code | `customer_number` | String; generated read-only | System generated | Allocated from the organization's CUSTOMER document sequence; client value rejected | Stable ERP identifier. |
| Overview | Email | `email` | String; email input | Optional | Maximum 320 characters; valid email syntax; unique per organization when present | Main account email. |
| Overview | Primary phone | `phone` | String; telephone input | Optional | 7-40 digits with optional leading `+`, spaces, parentheses, dots or dashes | Main account phone. |
| Overview | Website URL | `website` | String; URL input | Optional | Maximum 200 characters; `http://` or `https://` URL | Public company/customer website. |
| Overview | Country | `country_code` | ISO-3166-1 alpha-2; dropdown | Yes | Exactly two letters, normalized uppercase | Account domicile and default country for billing. |
| Overview | Taxpayer ID type | `tax_id_type` | Enum; dropdown | Optional | NTN, STRN or OTHER | Declares the kind of tax identifier. |
| Overview | Taxpayer ID / NTN | `tax_number` | String; text input | Optional | 2-64 letters, digits, dot, slash or dash | Taxpayer identification reference. |
| Overview | CNIC / passport type | `identity_document_type` | Enum; conditional dropdown | Individual only, optional | CNIC or PASSPORT; provide type and number together | Identifies an individual when legally required. |
| Overview | CNIC / passport number | `identity_document_number` | String; conditional sensitive input | Individual only, optional | CNIC: 13 digits, optionally `#####-#######-#`; passport: 5-20 alphanumeric characters | Identity verification reference; treat as sensitive personal data. |
| Address | Billing line 1 | `billing_line_1` (`addresses[].line1`) | String; text input | Required when a billing address is entered | Trimmed, 1-200 characters | Street, building and unit. |
| Address | Billing line 2 | `billing_line_2` (`addresses[].line2`) | String; text input | Optional | Maximum 200 characters | Suite, floor or additional locality. |
| Address | Billing city | `billing_city` (`addresses[].city`) | String; text input | Required when a billing address is entered | Trimmed, 1-120 characters | Billing locality. |
| Address | State / province | `billing_state` (`addresses[].region`) | String; text input | Optional | Maximum 120 characters | Billing region. |
| Address | Postal / ZIP code | `billing_postal_code` (`addresses[].postalCode`) | String; text input | Optional | Maximum 20 characters | Postal routing code. |
| Address | Billing country | `billing_country_code` (`addresses[].countryCode`) | ISO-3166-1 alpha-2; dropdown | Required when a billing address is entered | Exactly two letters, normalized uppercase | Billing jurisdiction. |
| Address | Delivery same as billing | `same_as_billing` | Boolean; checkbox/toggle | Yes; defaults true | Boolean | When true, shipping fields are suppressed and separate shipping rows are removed on save. |
| Address | Latitude | `addresses[].latitude` | Decimal; numeric input | Optional; pair with longitude | Between -90 and 90; both coordinates or neither | Geo-coordinate for mapping and delivery routing. |
| Address | Longitude | `addresses[].longitude` | Decimal; numeric input | Optional; pair with latitude | Between -180 and 180; both coordinates or neither | Geo-coordinate for mapping and delivery routing. |
| Address | Geofence radius (metres) | `addresses[].geofenceRadiusMeters` | Integer; numeric input | Optional | Positive whole number | Service/delivery geofence around the address. |
| Address | Shipping line 1 | `shipping_line_1` (`addresses[].line1`, purpose SHIPPING) | String; text input | Required when a shipping address is entered | Trimmed, 1-200 characters | Ship-to street/building. |
| Address | Shipping line 2 | `shipping_line_2` (`addresses[].line2`, purpose SHIPPING) | String; text input | Optional | Maximum 200 characters | Ship-to unit/floor. |
| Address | Shipping city | `shipping_city` (`addresses[].city`, purpose SHIPPING) | String; text input | Required when a shipping address is entered | Trimmed, 1-120 characters | Ship-to locality. |
| Address | Shipping state / province | `shipping_state` (`addresses[].region`, purpose SHIPPING) | String; text input | Optional | Maximum 120 characters | Ship-to region. |
| Address | Shipping country | `shipping_country_code` (`addresses[].countryCode`, purpose SHIPPING) | ISO-3166-1 alpha-2; dropdown | Required when a shipping address is entered | Exactly two letters, normalized uppercase | Ship-to jurisdiction. |
| Address | Shipping postal / ZIP code | `shipping_postal_code` (`addresses[].postalCode`, purpose SHIPPING) | String; text input | Optional | Maximum 20 characters | Ship-to postal routing code. |
| Contacts | Contact first name | `contacts[].first_name` (`contacts[].firstName`) | String; text input | Required when a contact row exists | Trimmed, 1-100 characters | Contact person's given name. |
| Contacts | Contact last name | `contacts[].last_name` (`contacts[].lastName`) | String; text input | Required when a contact row exists | Trimmed, 1-100 characters | Contact person's family name. |
| Contacts | Designation | `contacts[].job_title` (`contacts[].jobTitle`) | String; text input | Optional | Maximum 120 characters | Contact's job title. |
| Contacts | Department | `contacts[].department` | String; text input | Optional | Maximum 120 characters | Contact's department or function. |
| Contacts | Contact role | `contacts[].role` | Enum; dropdown | Optional | BILLING, PROCUREMENT, FINANCE, OPERATIONS, SALES or OTHER | Operational responsibility. |
| Contacts | Direct email | `contacts[].email` | String; email input | Optional | Maximum 320 characters; valid email when present | Direct contact email. |
| Contacts | Direct phone | `contacts[].phone` | String; telephone input | Optional | Maximum 40 characters; 7-40 digits or phone punctuation | Direct contact phone. |
| Contacts | Mobile | `contacts[].mobile` | String; telephone input | Optional | Maximum 40 characters; 7-40 digits or phone punctuation | Direct contact mobile number. |
| Contacts | Contact notes | `contacts[].notes` | String; text input | Optional | Maximum 4,000 characters | Internal notes about the contact. |
| Contacts | Primary contact | `contacts[].is_primary` (`contacts[].isPrimary`) | Boolean; checkbox | Optional; at most one true | Boolean; duplicate primary contacts rejected | Preferred contact for the account. |
| Contacts | Contact email permission | `contacts[].email_opt_in` (`contacts[].emailOptIn`) | Boolean; checkbox | Optional; defaults false | Boolean | Contact-level communication consent. |
| Contacts | Contact phone permission | `contacts[].phone_opt_in` (`contacts[].phoneOptIn`) | Boolean; checkbox | Optional; defaults false | Boolean | Consent to contact by phone. |
| Contacts | Contact SMS permission | `contacts[].sms_opt_in` (`contacts[].smsOptIn`) | Boolean; checkbox | Optional; defaults false | Boolean | Consent to contact by SMS. |
| Contacts | Contact WhatsApp permission | `contacts[].whatsapp_opt_in` (`contacts[].whatsappOptIn`) | Boolean; checkbox | Optional; defaults false | Boolean | Consent to contact by WhatsApp. |
| Business | Customer category / tier | `customer_category` | Enum; dropdown | Optional | RETAIL, WHOLESALE, CORPORATE, VIP, PARTNER or OTHER | Customer classification for service and commercial policy. |
| Business | Employee count | `employee_count` | Integer; numeric input | Optional; company only | Whole number, minimum 0 | Company size segmentation. |
| Business | Industry sector | `industry` | String; text/autocomplete | Optional | Maximum 120 characters | Industry classification. |
| Business | Incorporation status | `incorporation_status` | Enum; dropdown | Optional; company only | REGISTERED, PENDING, UNREGISTERED or NOT_APPLICABLE | Legal registration state. |
| Business | Business registration date | `business_registration_date` | Date; date picker | Optional; company only | ISO date (`YYYY-MM-DD`) | Date the entity registered. |
| Business | Email marketing opt-in | `email_marketing_opt_in` | Boolean; consent checkbox | Optional; defaults false | Must reflect explicit affirmative consent | Customer account-level marketing permission. |
| Business | Lead source / referral origin | `lead_source` | Enum; dropdown | Optional | WEBSITE, REFERRAL, COLD_CALL, SOCIAL_MEDIA, ADVERTISEMENT, PARTNER, TENDER or OTHER | Acquisition attribution. |
| Business | Account owner | `assigned_sales_rep_id` | UUID reference; organization-scoped dropdown | Optional | Must reference an active user in this organization | Internal relationship owner. |
| Finance | Payment terms | `payment_term_id` | UUID reference; dropdown | Optional | Active organization term; e.g. Due on receipt, Net 30 | Default invoice due policy. |
| Finance | Currency | `currency_code` | ISO-4217 alpha-3; dropdown | Yes | Exactly three letters; must be an active currency | Account transaction/default display currency. |
| Finance | Price list / family | `pricing_group_id` | UUID reference; dropdown | Optional | Active organization pricing group | Default pricing treatment. |
| Finance | Sales tax group | `default_tax_code_id` | UUID reference; dropdown | Optional | Active tax code belonging to the organization | Default sales tax code/rate. |
| Finance | Tax exempt | `tax_exempt` | Boolean; checkbox | Optional; defaults false | When true, an exemption code is required | Exemption from configured sales tax. |
| Finance | Tax exemption code | `tax_exemption_code` | String; text input | Required when tax exempt | 2-64 letters, digits, slash, dash or underscore | Reference for the exemption certificate/authority. |
| Finance | Credit limit | `credit_limit` | Decimal string; numeric input | Optional; defaults 0 | Non-negative; up to 15 integer and 4 fractional digits | Maximum permitted credit exposure. |
| Finance | Credit hold | `credit_hold` | Boolean; toggle | Optional; defaults false | Boolean | Blocks further credit sales pending review. |
| Finance | Preferred payment method | `preferred_payment_method` | Enum; dropdown | Optional | BANK_TRANSFER, CASH, CARD, CHEQUE, MOBILE_WALLET or OTHER | Customer's preferred settlement method. |
| Finance | Preferred communication channel | `preferred_communication_channel` | Enum; dropdown | Optional | EMAIL, PHONE, SMS or WHATSAPP | Default non-marketing contact channel. |
| Finance | Opening balance | `opening_balance` | Signed decimal string; numeric input | Optional; defaults 0 | Up to 15 integer and 4 fractional digits | Starting balance at ERP go-live; not a live outstanding calculation. |
| Finance | Opening balance date | `opening_balance_date` | Date; date picker | Optional | ISO date (`YYYY-MM-DD`) | Date at which opening balance is valid. |
| Notes | Internal notes / remarks | `notes` | String; textarea | Optional | Maximum 4,000 characters | Internal-only customer context. |

## Persistence Notes

- Address and contact rows remain normalized child records; their labels above are logical form names, while API payloads use camelCase nested paths.
- Defaults are intentionally conservative: marketing consent off, credit hold off, delivery same as billing on, tax exemption off, and generated customer code not editable.
- The customer record currently stores opening balance, but there is no customer-linked invoice/payment ledger in this schema from which to calculate outstanding balance.