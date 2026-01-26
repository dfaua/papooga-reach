-- Companies table
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    linkedin_url TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    industry TEXT,
    employee_count TEXT,
    description TEXT,
    website TEXT,
    location TEXT,
    is_contacted BOOLEAN DEFAULT FALSE,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- People table
CREATE TABLE people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    linkedin_url TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    title TEXT,
    company_name TEXT,
    company_linkedin_url TEXT,
    status TEXT DEFAULT 'saved' CHECK (status IN ('saved', 'requested', 'accepted', 'messaged', 'replied')),
    notes TEXT,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outreach logs table
CREATE TABLE outreach_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID REFERENCES people(id) ON DELETE CASCADE NOT NULL,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_companies_linkedin_url ON companies(linkedin_url);
CREATE INDEX idx_companies_is_contacted ON companies(is_contacted);
CREATE INDEX idx_people_linkedin_url ON people(linkedin_url);
CREATE INDEX idx_people_company_id ON people(company_id);
CREATE INDEX idx_people_status ON people(status);
CREATE INDEX idx_outreach_logs_person_id ON outreach_logs(person_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_people_updated_at
    BEFORE UPDATE ON people
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
