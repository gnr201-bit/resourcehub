-- 1. 임직원 테이블 (employees)
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL,
    role_title TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'retired', 'onboarding')),
    joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
    retired_at DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. IT 자산 테이블 (assets)
CREATE TABLE IF NOT EXISTS public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    spec TEXT,
    price NUMERIC,
    purchased_at DATE,
    manufacturer TEXT,
    model_name TEXT,
    status TEXT NOT NULL DEFAULT 'unassigned' CHECK (status IN ('normal', 'repairing', 'disposed', 'unassigned')),
    location TEXT,
    assigned_to UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. SaaS 서비스 테이블 (saas_services)
CREATE TABLE IF NOT EXISTS public.saas_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    total_licenses INTEGER NOT NULL DEFAULT 0,
    used_licenses INTEGER NOT NULL DEFAULT 0,
    warning_threshold INTEGER NOT NULL DEFAULT 5,
    price_per_license INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. SaaS 계정 테이블 (saas_accounts)
CREATE TABLE IF NOT EXISTS public.saas_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
    saas_id UUID REFERENCES public.saas_services(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. HR 이벤트 테이블 (hr_events)
CREATE TABLE IF NOT EXISTS public.hr_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL CHECK (event_type IN ('onboarding', 'offboarding', 'transfer')),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    details JSONB DEFAULT '{}'::jsonb,
    event_date DATE NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. 자원 요청 테이블 (resource_requests)
CREATE TABLE IF NOT EXISTS public.resource_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
    request_type TEXT NOT NULL CHECK (request_type IN ('new_resource', 'return_resource')),
    resource_category TEXT NOT NULL CHECK (resource_category IN ('IT Asset', 'SaaS', 'Other')),
    resource_name TEXT NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- 7. 시스템 동기화 로그 테이블 (sync_logs)
CREATE TABLE IF NOT EXISTS public.sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'warning', 'error')),
    message TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 테이블 RLS 비활성화 (MVP 빠른 개발 목적)
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_services DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs DISABLE ROW LEVEL SECURITY;

-- 2. 기존 서비스 가격 업데이트 및 신규 서비스 추가
INSERT INTO public.saas_services (name, total_licenses, used_licenses, warning_threshold, price_per_license)
VALUES 
('Slack', 100, 8, 10, 8000),
('Microsoft 365', 150, 7, 15, 16000),
('Jira Software', 50, 6, 5, 11000),
('Zoom', 80, 5, 5, 15000),
('Figma', 30, 4, 3, 20000)
ON CONFLICT (name) DO UPDATE SET 
  total_licenses = EXCLUDED.total_licenses,
  used_licenses = EXCLUDED.used_licenses,
  warning_threshold = EXCLUDED.warning_threshold,
  price_per_license = EXCLUDED.price_per_license;

-- 3. 임직원 추가 (풍부한 데이터)
INSERT INTO public.employees (name, email, department, role_title, status, joined_at, retired_at)
VALUES 
('admin', 'admin@company.com', 'IT운영팀', '시스템관리자', 'active', '2025-01-01', NULL),
('홍길동', 'gildong@company.com', '마케팅팀', '팀장', 'active', '2025-03-15', NULL),
('김철수', 'chulsoo@company.com', '개발1팀', '수석연구원', 'active', '2025-06-01', NULL),
('이영희', 'younghee@company.com', '인사팀', '선임', 'active', '2025-09-10', NULL),
('박민수', 'minsu@company.com', '영업팀', '사원', 'active', '2026-02-20', NULL),
('최지우', 'jiwoo@company.com', '마케팅팀', '대리', 'active', '2025-04-10', NULL),
('정우성', 'woosung@company.com', '개발2팀', '선임연구원', 'active', '2025-08-01', NULL),
('한효주', 'hyoju@company.com', '디자인팀', '과장', 'active', '2025-10-15', NULL),
('이정재', 'jungjae@company.com', '영업팀', '팀장', 'active', '2025-11-20', NULL),
('송혜교', 'hyekyo@company.com', '인사팀', '과장', 'active', '2025-12-05', NULL),
('강호동', 'hodong@company.com', '영업팀', '부장', 'retired', '2024-05-10', '2026-06-15'),
('유재석', 'jaeseok@company.com', '개발1팀', '팀장', 'retired', '2024-03-01', '2026-06-18'),
('장나라', 'nara@company.com', '디자인팀', '주임디자이너', 'onboarding', '2026-06-26', NULL),
('신민아', 'mina@company.com', '마케팅팀', '사원', 'onboarding', '2026-07-01', NULL),
('현빈', 'bin@company.com', '개발1팀', '선임연구원', 'onboarding', '2026-07-10', NULL)
ON CONFLICT (email) DO UPDATE SET 
  name = EXCLUDED.name,
  department = EXCLUDED.department,
  role_title = EXCLUDED.role_title,
  status = EXCLUDED.status,
  joined_at = EXCLUDED.joined_at,
  retired_at = EXCLUDED.retired_at;

-- 4. IT 자산 추가 (풍부한 데이터)
INSERT INTO public.assets (serial_number, name, category, spec, price, purchased_at, manufacturer, model_name, status, location, assigned_to, assigned_at)
VALUES 
('SN-MAC-001', 'MacBook Pro 16"', '노트북', 'M3 Max, 32GB, 1TB', 4200000, '2025-01-10', 'Apple', 'MacBook Pro 16', 'normal', '서울본사 10층', (SELECT id FROM public.employees WHERE email='admin@company.com'), '2025-01-10'),
('SN-DEL-002', 'Dell XPS 15', '노트북', 'i9, 32GB, 1TB', 3100000, '2025-03-20', 'Dell', 'XPS 15', 'normal', '서울본사 12층', (SELECT id FROM public.employees WHERE email='gildong@company.com'), '2025-03-20'),
('SN-GRA-003', 'LG Gram 17', '노트북', 'Ultra 7, 16GB, 512GB', 2100000, '2025-06-05', 'LG', 'Gram 17', 'normal', '서울본사 8층', (SELECT id FROM public.employees WHERE email='chulsoo@company.com'), '2025-06-05'),
('SN-MON-004', '삼성 27인치 모니터', '모니터', 'QHD, IPS, 75Hz', 350000, '2025-03-20', 'Samsung', 'S27A600', 'normal', '서울본사 12층', (SELECT id FROM public.employees WHERE email='gildong@company.com'), '2025-03-20'),
('SN-KEY-005', '애플 매직 키보드', '기타', '텐키리스, 한글', 119000, '2025-09-15', 'Apple', 'Magic Keyboard', 'normal', '서울본사 10층', (SELECT id FROM public.employees WHERE email='younghee@company.com'), '2025-09-15'),
('SN-MAC-010', 'MacBook Pro 14"', '노트북', 'M3 Pro, 18GB, 512GB', 2990000, '2025-04-10', 'Apple', 'MacBook Pro 14', 'normal', '서울본사 12층', (SELECT id FROM public.employees WHERE email='jiwoo@company.com'), '2025-04-10'),
('SN-DEL-011', 'Dell Latitude 5540', '노트북', 'i7, 16GB, 512GB', 1800000, '2025-08-01', 'Dell', 'Latitude 5540', 'normal', '서울본사 8층', (SELECT id FROM public.employees WHERE email='woosung@company.com'), '2025-08-01'),
('SN-MAC-012', 'MacBook Pro 16"', '노트북', 'M3 Pro, 36GB, 512GB', 3690000, '2025-10-15', 'Apple', 'MacBook Pro 16', 'normal', '서울본사 10층', (SELECT id FROM public.employees WHERE email='hyoju@company.com'), '2025-10-15'),
('SN-DEL-013', 'Dell XPS 13', '노트북', 'i7, 16GB, 512GB', 2100000, '2025-11-20', 'Dell', 'XPS 13', 'normal', '서울본사 14층', (SELECT id FROM public.employees WHERE email='jungjae@company.com'), '2025-11-20'),
('SN-MON-014', 'LG 27인치 모니터', '모니터', 'UHD, IPS, 60Hz', 450000, '2025-12-05', 'LG', '27UP850N', 'normal', '서울본사 10층', (SELECT id FROM public.employees WHERE email='hyekyo@company.com'), '2025-12-05'),
('SN-IPA-006', 'iPad Pro 11"', '태블릿', 'M2, 128GB, Wi-Fi', 1249000, '2025-05-12', 'Apple', 'iPad Pro 11', 'repairing', 'IT자산고', NULL, NULL),
('SN-THI-007', 'Lenovo ThinkPad X1 Carbon', '노트북', 'i7, 16GB, 512GB', 2500000, '2024-02-10', 'Lenovo', 'X1 Carbon', 'disposed', '폐기처분함', NULL, NULL),
('SN-MON-008', 'LG 울트라와이드 34인치', '모니터', 'WQHD, IPS', 650000, '2026-03-01', 'LG', '34WN750', 'unassigned', 'IT자산고', NULL, NULL),
('SN-MAC-009', 'MacBook Air 13"', '노트북', 'M2, 16GB, 512GB', 1690000, '2026-03-05', 'Apple', 'MacBook Air 13', 'unassigned', 'IT자산고', NULL, NULL),
('SN-MON-015', '삼성 32인치 4K 모니터', '모니터', 'UHD, VA, 60Hz', 490000, '2026-04-10', 'Samsung', 'S32B700', 'unassigned', 'IT자산고', NULL, NULL),
('SN-KEY-016', '로지텍 MX Keys', '기타', '블루투스, 펜타그래프', 149000, '2025-06-10', 'Logitech', 'MX Keys', 'unassigned', 'IT자산고', NULL, NULL),
-- 퇴사자 미회수 자산 (경고 대상)
('SN-DEL-020', 'Dell Latitude 7440', '노트북', 'i7, 16GB, 512GB', 2200000, '2024-05-10', 'Dell', 'Latitude 7440', 'normal', '서울본사 14층', (SELECT id FROM public.employees WHERE email='hodong@company.com'), '2024-05-10'),
('SN-MAC-021', 'MacBook Pro 14"', '노트북', 'M2 Pro, 16GB, 512GB', 2790000, '2024-03-01', 'Apple', 'MacBook Pro 14', 'normal', '서울본사 8층', (SELECT id FROM public.employees WHERE email='jaeseok@company.com'), '2024-03-01')
ON CONFLICT (serial_number) DO UPDATE SET 
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  spec = EXCLUDED.spec,
  price = EXCLUDED.price,
  purchased_at = EXCLUDED.purchased_at,
  manufacturer = EXCLUDED.manufacturer,
  model_name = EXCLUDED.model_name,
  status = EXCLUDED.status,
  location = EXCLUDED.location,
  assigned_to = EXCLUDED.assigned_to,
  assigned_at = EXCLUDED.assigned_at;

-- 5. SaaS 계정 추가 (풍부한 데이터)
DELETE FROM public.saas_accounts; -- 중복 방지 위해 초기화 후 재적재
INSERT INTO public.saas_accounts (employee_id, saas_id, email, status)
VALUES
((SELECT id FROM public.employees WHERE email='admin@company.com'), (SELECT id FROM public.saas_services WHERE name='Slack'), 'admin@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='admin@company.com'), (SELECT id FROM public.saas_services WHERE name='Microsoft 365'), 'admin@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='admin@company.com'), (SELECT id FROM public.saas_services WHERE name='Jira Software'), 'admin@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='gildong@company.com'), (SELECT id FROM public.saas_services WHERE name='Slack'), 'gildong@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='gildong@company.com'), (SELECT id FROM public.saas_services WHERE name='Microsoft 365'), 'gildong@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='chulsoo@company.com'), (SELECT id FROM public.saas_services WHERE name='Slack'), 'chulsoo@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='chulsoo@company.com'), (SELECT id FROM public.saas_services WHERE name='Jira Software'), 'chulsoo@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='younghee@company.com'), (SELECT id FROM public.saas_services WHERE name='Slack'), 'younghee@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='jiwoo@company.com'), (SELECT id FROM public.saas_services WHERE name='Slack'), 'jiwoo@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='jiwoo@company.com'), (SELECT id FROM public.saas_services WHERE name='Figma'), 'jiwoo@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='woosung@company.com'), (SELECT id FROM public.saas_services WHERE name='Slack'), 'woosung@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='woosung@company.com'), (SELECT id FROM public.saas_services WHERE name='Microsoft 365'), 'woosung@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='hyoju@company.com'), (SELECT id FROM public.saas_services WHERE name='Slack'), 'hyoju@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='hyoju@company.com'), (SELECT id FROM public.saas_services WHERE name='Figma'), 'hyoju@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='jungjae@company.com'), (SELECT id FROM public.saas_services WHERE name='Slack'), 'jungjae@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='jungjae@company.com'), (SELECT id FROM public.saas_services WHERE name='Microsoft 365'), 'jungjae@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='jungjae@company.com'), (SELECT id FROM public.saas_services WHERE name='Jira Software'), 'jungjae@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='hyekyo@company.com'), (SELECT id FROM public.saas_services WHERE name='Microsoft 365'), 'hyekyo@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='hyekyo@company.com'), (SELECT id FROM public.saas_services WHERE name='Zoom'), 'hyekyo@company.com', 'active'),
-- 퇴사자 소유 계정 (active 상태에서 deprovisioning 진행 대상)
((SELECT id FROM public.employees WHERE email='jaeseok@company.com'), (SELECT id FROM public.saas_services WHERE name='Slack'), 'jaeseok@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='jaeseok@company.com'), (SELECT id FROM public.saas_services WHERE name='Microsoft 365'), 'jaeseok@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='jaeseok@company.com'), (SELECT id FROM public.saas_services WHERE name='Jira Software'), 'jaeseok@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='jaeseok@company.com'), (SELECT id FROM public.saas_services WHERE name='Zoom'), 'jaeseok@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='jaeseok@company.com'), (SELECT id FROM public.saas_services WHERE name='Figma'), 'jaeseok@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='hodong@company.com'), (SELECT id FROM public.saas_services WHERE name='Slack'), 'hodong@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='hodong@company.com'), (SELECT id FROM public.saas_services WHERE name='Microsoft 365'), 'hodong@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='hodong@company.com'), (SELECT id FROM public.saas_services WHERE name='Zoom'), 'hodong@company.com', 'active'),
((SELECT id FROM public.employees WHERE email='hodong@company.com'), (SELECT id FROM public.saas_services WHERE name='Figma'), 'hodong@company.com', 'active');

-- 6. 서비스별 실제 사용 계정 카운트 정밀 정렬
UPDATE public.saas_services SET used_licenses = (SELECT COUNT(*) FROM public.saas_accounts WHERE saas_id = public.saas_services.id AND status = 'active');

-- 7. 대기 중인 자원 요청 데이터 주입 (dashboard & admin-requests 노출용)
DELETE FROM public.resource_requests;
INSERT INTO public.resource_requests (employee_id, request_type, resource_category, resource_name, reason, status)
VALUES
((SELECT id FROM public.employees WHERE email='chulsoo@company.com'), 'new_resource', 'SaaS', 'Figma', '디자인 검토 및 UI/UX 협업 필요', 'pending'),
((SELECT id FROM public.employees WHERE email='minsu@company.com'), 'new_resource', 'IT Asset', '삼성 27인치 모니터', '듀얼 모니터 구성을 통한 업무 속도 향상', 'pending'),
((SELECT id FROM public.employees WHERE email='hyekyo@company.com'), 'new_resource', 'Other', '높낮이 조절 책상 (모션데스크)', '거북목 증상 예방 및 집중력 강화', 'pending'),
((SELECT id FROM public.employees WHERE email='gildong@company.com'), 'return_resource', 'IT Asset', '[노트북] Dell XPS 15 (S/N: SN-DEL-002)', '새 노트북 배정으로 인한 기존 장비 반납', 'pending'),
((SELECT id FROM public.employees WHERE email='younghee@company.com'), 'return_resource', 'SaaS', 'Slack (younghee@company.com)', '부서 이동으로 인한 계정 회수 요청', 'pending');

-- 8. 동기화 로그 데이터 주입
DELETE FROM public.sync_logs;
INSERT INTO public.sync_logs (log_type, status, message, details)
VALUES
('sync_hr', 'success', '레거시 HR API와 동기화를 성공적으로 완료했습니다. (업데이트된 변경 사항 없음)', '{"api_endpoint":"https://legacy-hr-api.company.internal/v1","sync_type":"manual","processed_records":0}'),
('saas_provisioning', 'success', 'SaaS [Slack] 계정(jiwoo@company.com)이 최지우 사원에게 정상 할당되었습니다.', '{"action":"provision","saas":"Slack","email":"jiwoo@company.com"}'),
('asset_assignment', 'success', '자산 [MacBook Pro 14"] (S/N: SN-MAC-010)이(가) 최지우 사원에게 지급 완료되었습니다.', '{"action":"assign","asset_id":"SN-MAC-010","employee":"최지우"}'),
('transfer_adjustment', 'success', '정우성 사원의 부서 이동 처리 완료 (개발1팀 -> 개발2팀)', '{"employee":"정우성","from":"개발1팀","to":"개발2팀"}'),
('sync_hr', 'error', '레거시 HR API 동기화 과정에서 서버 타임아웃 오류가 발생했습니다. (재시도 예정)', 'Timeout of 5000ms exceeded during API fetch');

-- 8. 가상 레거시 인사 데이터 테이블 (legacy_hr_employees)
CREATE TABLE IF NOT EXISTS public.legacy_hr_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL,
    role_title TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('onboarding', 'offboarding', 'transfer')),
    event_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'error')),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS 활성화 및 전체 허용 정책 적용 (인증 없이 가상 데이터 등록/동기화 테스트를 지원하기 위함)
ALTER TABLE public.legacy_hr_employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for legacy_hr_employees" ON public.legacy_hr_employees;
CREATE POLICY "Allow all operations for legacy_hr_employees" 
ON public.legacy_hr_employees 
FOR ALL 
TO public 
USING (true) 
WITH CHECK (true);

-- 테스트용 초기 가상 인사 변동 데이터 삽입
INSERT INTO public.legacy_hr_employees (name, email, department, role_title, event_type, event_date, status, details)
VALUES 
('아이유', 'iu@company.com', '개발2팀', '선임연구원', 'onboarding', '2026-07-01', 'pending', '{}'),
('유재석', 'jaeseok@company.com', '개발1팀', '팀장', 'offboarding', '2026-06-18', 'pending', '{}'),
('김철수', 'chulsoo@company.com', '개발1팀', '수석연구원', 'transfer', '2026-06-25', 'pending', '{"target_department": "IT운영팀", "target_role_title": "팀장"}')
ON CONFLICT (email) DO NOTHING;


-- 9. 시스템 설정 테이블 (system_settings)
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for system_settings" ON public.system_settings;
CREATE POLICY "Allow all operations for system_settings" 
ON public.system_settings 
FOR ALL 
TO public 
USING (true) 
WITH CHECK (true);

INSERT INTO public.system_settings (key, value)
VALUES ('warning_rules', '{"retiredAssetWarningDays": 3, "assetStockThreshold": 3}'::jsonb)
ON CONFLICT (key) DO NOTHING;


