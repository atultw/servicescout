
export interface Session {
  id: string;
  name: string;
  description?: string;
  history: { user: string; agent: string }[];
}

export interface Call {
  call_id: string;
  biz_name: string;
  phone_number: string;
  outcome_summary?: string;
  success?: boolean;
}

export interface CallDetails extends Call {
  transcript?: { role: string; text: string }[];
}

export interface Business {
  name: string;
  phone_number: string;
  address?: string;
  rating?: number;
  review_count?: number;
  picture?: string;
}
