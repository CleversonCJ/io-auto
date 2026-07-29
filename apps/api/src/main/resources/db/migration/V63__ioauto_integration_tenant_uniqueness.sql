drop index if exists uq_ioauto_integrations_company_provider;

with cleaned_integrations as (
    select
        id,
        coalesce(
            nullif(
                regexp_replace(
                    regexp_replace(lower(btrim(provider_key)), '[^a-z0-9-]+', '-', 'g'),
                    '(^-+|-+$)',
                    '',
                    'g'
                ),
                ''
            ),
            'legacy-' || id::text
        ) as cleaned_provider_key
    from ioauto_integrations
),
canonical_integrations as (
    select
        id,
        case cleaned_provider_key
            when 'mercado-livre' then 'mercadolivre'
            when 'meli' then 'mercadolivre'
            when 'olx-autos' then 'olx'
            when 'web-motors' then 'webmotors'
            else cleaned_provider_key
        end as canonical_provider_key
    from cleaned_integrations
)
update ioauto_integrations integration
set provider_key = canonical.canonical_provider_key,
    updated_at = now()
from canonical_integrations canonical
where integration.id = canonical.id
  and integration.provider_key is distinct from canonical.canonical_provider_key;

with ranked_integrations as (
    select
        id,
        row_number() over (
            partition by company_id, lower(provider_key)
            order by
                case when upper(status) in ('CONNECTED', 'ACTIVE') then 0 else 1 end,
                updated_at desc,
                created_at desc,
                id
        ) as duplicate_rank
    from ioauto_integrations
)
delete from ioauto_integrations integration
using ranked_integrations ranked
where integration.id = ranked.id
  and ranked.duplicate_rank > 1;

create unique index uq_ioauto_integrations_company_provider
    on ioauto_integrations (company_id, lower(provider_key));

alter table ioauto_integrations
    drop constraint if exists ck_ioauto_integrations_provider_key_normalized;

alter table ioauto_integrations
    add constraint ck_ioauto_integrations_provider_key_normalized
        check (
            provider_key <> ''
            and provider_key = lower(btrim(provider_key))
            and provider_key not in ('mercado-livre', 'meli', 'olx-autos', 'web-motors')
        );
