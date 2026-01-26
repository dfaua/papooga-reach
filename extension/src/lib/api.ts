// API client that routes requests through the background service worker
// This bypasses CORS restrictions for content scripts

interface Company {
  id?: string;
  linkedin_url: string;
  name: string;
  industry?: string;
  employee_count?: string;
  description?: string;
  website?: string;
  location?: string;
  revenue_range?: string;
  is_contacted?: boolean;
  raw_data?: Record<string, unknown>;
}

interface Person {
  id?: string;
  linkedin_url: string;
  linkedin_profile_url?: string;
  name: string;
  title?: string;
  company_id?: string;
  company_name?: string;
  company_linkedin_url?: string;
  status?: "saved" | "requested" | "accepted" | "messaged" | "replied";
  notes?: string;
  connections_count?: number;
  followers_count?: number;
  raw_data?: Record<string, unknown>;
}

interface CheckResult {
  [url: string]: {
    exists: boolean;
    is_contacted: boolean;
  };
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  console.log(`Papooga API: START ${options.method || "GET"} ${endpoint}`);
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    console.log(`Papooga API: Sending message to background...`);
    chrome.runtime.sendMessage(
      {
        type: "API_REQUEST",
        endpoint,
        options,
      },
      (response) => {
        const elapsed = Date.now() - startTime;
        console.log(`Papooga API: END ${endpoint} - ${elapsed}ms`);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response?.success) {
          resolve(response.data as T);
        } else {
          reject(new Error(response?.error || "Unknown error"));
        }
      }
    );
  });
}

interface ExistsResult {
  exists: boolean;
  id?: string;
  name?: string;
}

export const api = {
  // Companies
  async checkCompanyByUrl(url: string): Promise<ExistsResult> {
    return apiRequest<ExistsResult>(`/api/companies/by-url?url=${encodeURIComponent(url)}`);
  },

  async findCompanyByUrl(url: string): Promise<{ id: string; name: string } | null> {
    const result = await this.checkCompanyByUrl(url);
    if (result.exists && result.id) {
      return { id: result.id, name: result.name || "" };
    }
    return null;
  },

  async checkCompanies(urls: string[]): Promise<CheckResult> {
    return apiRequest<CheckResult>("/api/companies/check", {
      method: "POST",
      body: JSON.stringify({ urls }),
    });
  },

  async saveCompany(company: Company): Promise<Company> {
    return apiRequest<Company>("/api/companies", {
      method: "POST",
      body: JSON.stringify(company),
    });
  },

  async getCompany(id: string): Promise<Company> {
    return apiRequest<Company>(`/api/companies/${id}`);
  },

  async updateCompany(id: string, updates: Partial<Company>): Promise<Company> {
    return apiRequest<Company>(`/api/companies/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },

  // People
  async checkPersonByUrl(url: string): Promise<ExistsResult> {
    return apiRequest<ExistsResult>(`/api/people/by-url?url=${encodeURIComponent(url)}`);
  },

  async savePerson(person: Person): Promise<Person> {
    return apiRequest<Person>("/api/people", {
      method: "POST",
      body: JSON.stringify(person),
    });
  },

  async getPerson(id: string): Promise<Person> {
    return apiRequest<Person>(`/api/people/${id}`);
  },

  async updatePerson(id: string, updates: Partial<Person>): Promise<Person> {
    return apiRequest<Person>(`/api/people/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },

  async getPeople(filters?: {
    status?: string;
    company_id?: string;
  }): Promise<Person[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.company_id) params.set("company_id", filters.company_id);
    const query = params.toString();
    return apiRequest<Person[]>(`/api/people${query ? `?${query}` : ""}`);
  },
};
