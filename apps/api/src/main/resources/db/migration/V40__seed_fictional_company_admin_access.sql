-- Empresa ficticia para testes sem privilegios de SUPERADMIN
-- Email: ficticia.admin.demo@ioauto.local
-- Senha: Admin@123

insert into companies (
    id,
    name,
    profile_image_url,
    email,
    contract_end_date,
    cnpj,
    opened_at,
    whatsapp_number,
    zapi_instance_id,
    zapi_instance_token,
    zapi_client_token,
    business_hours_start,
    business_hours_end,
    business_hours_weekly_json,
    public_stock_banner_mode,
    public_stock_banner_images_json
)
values (
    '00000000-0000-0000-0000-000000000002',
    'Auto Demo Ficticia',
    null,
    'empresa.demo.ficticia@ioauto.local',
    date '2099-12-31',
    '12345678000199',
    date '2024-01-01',
    '11999999999',
    '',
    '',
    '',
    '09:00',
    '18:00',
    '{"sunday":{"active":false,"start":"09:00","lunchStart":"12:00","lunchEnd":"13:00","end":"18:00"},"monday":{"active":true,"start":"09:00","lunchStart":"12:00","lunchEnd":"13:00","end":"18:00"},"tuesday":{"active":true,"start":"09:00","lunchStart":"12:00","lunchEnd":"13:00","end":"18:00"},"wednesday":{"active":true,"start":"09:00","lunchStart":"12:00","lunchEnd":"13:00","end":"18:00"},"thursday":{"active":true,"start":"09:00","lunchStart":"12:00","lunchEnd":"13:00","end":"18:00"},"friday":{"active":true,"start":"09:00","lunchStart":"12:00","lunchEnd":"13:00","end":"18:00"},"saturday":{"active":false,"start":"09:00","lunchStart":"12:00","lunchEnd":"13:00","end":"18:00"}}',
    'VEHICLES',
    '[]'
)
on conflict (id) do update
set name = excluded.name,
    profile_image_url = excluded.profile_image_url,
    email = excluded.email,
    contract_end_date = excluded.contract_end_date,
    cnpj = excluded.cnpj,
    opened_at = excluded.opened_at,
    whatsapp_number = excluded.whatsapp_number,
    zapi_instance_id = excluded.zapi_instance_id,
    zapi_instance_token = excluded.zapi_instance_token,
    zapi_client_token = excluded.zapi_client_token,
    business_hours_start = excluded.business_hours_start,
    business_hours_end = excluded.business_hours_end,
    business_hours_weekly_json = excluded.business_hours_weekly_json,
    public_stock_banner_mode = excluded.public_stock_banner_mode,
    public_stock_banner_images_json = excluded.public_stock_banner_images_json;

insert into teams (
    id,
    company_id,
    name,
    created_at,
    updated_at
)
values (
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000002',
    'Equipe Geral',
    now(),
    now()
)
on conflict (id) do update
set company_id = excluded.company_id,
    name = excluded.name,
    updated_at = now();

insert into users (
    id,
    company_id,
    email,
    password_hash,
    full_name,
    is_active,
    job_title,
    permission_preset,
    module_permissions,
    team_id
)
values (
    '00000000-0000-0000-0000-000000000200',
    '00000000-0000-0000-0000-000000000002',
    'ficticia.admin.demo@ioauto.local',
    '$2a$10$WJuStJ2axeWO8ukE305FXezO7Yd88MuAVr4ahmmkG3EM7KkOsIJby',
    'Administrador Demo',
    true,
    'Administrador',
    'admin',
    null,
    '00000000-0000-0000-0000-000000000020'
)
on conflict (company_id, email) do update
set password_hash = excluded.password_hash,
    full_name = excluded.full_name,
    is_active = excluded.is_active,
    job_title = excluded.job_title,
    permission_preset = excluded.permission_preset,
    module_permissions = excluded.module_permissions,
    team_id = excluded.team_id;

insert into user_roles (user_id, role_id)
select
    '00000000-0000-0000-0000-000000000200',
    r.id
from roles r
where r.name = 'ADMIN'
on conflict (user_id, role_id) do nothing;

delete from user_roles
where user_id = '00000000-0000-0000-0000-000000000200'
  and role_id in (
      select id
      from roles
      where name = 'SUPERADMIN'
  );
