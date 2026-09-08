from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class DistributorConfig(BaseModel):
    id: str
    name: str
    base_url: str
    login_url: Optional[str] = ""
    username: Optional[str] = ""
    password: Optional[str] = None  # Sólo se envía al guardar/editar, no se expone en plano en el listado
    is_active: bool = True
    scraper_type: str = "mock"  # "mock", "generic_http", "playwright", "custom"
    last_login_status: str = "UNTESTED"  # "OK", "ERROR", "UNTESTED"
    last_login_msg: Optional[str] = ""
    custom_config: Optional[Dict[str, Any]] = None
    updated_at: Optional[str] = ""

class DistributorResponse(BaseModel):
    id: str
    name: str
    base_url: str
    login_url: Optional[str] = ""
    username: Optional[str] = ""
    is_active: bool
    scraper_type: str
    last_login_status: str
    last_login_msg: Optional[str] = ""
    updated_at: Optional[str] = ""

class PartResult(BaseModel):
    distributor_id: str
    distributor_name: str
    sku: str
    description: str
    brand: Optional[str] = "Generico"
    price: float
    currency: str = "ARS"
    stock: str = "Disponible"
    has_stock: bool = True
    delivery_time: Optional[str] = "Inmediato"
    product_url: Optional[str] = "#"
    scraped_at: str
    is_best_price: bool = False
    original_price: Optional[float] = None
    original_currency: Optional[str] = None
    exchange_rate_used: Optional[float] = None
    relevance_score: Optional[int] = None
    match_tier: Optional[str] = None  # "exact", "high", "medium"

class SearchResponse(BaseModel):
    query: str
    total_results: int
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    average_price: Optional[float] = None
    best_option: Optional[PartResult] = None
    results: List[PartResult] = []
    distributors_queried: List[str] = []
    errors: List[str] = []
    dolar_blue_rate: Optional[float] = None
    filtered_out_count: Optional[int] = 0

class LoginTestRequest(BaseModel):
    distributor_id: str

class LoginTestResponse(BaseModel):
    distributor_id: str
    success: bool
    message: str
    cookies_saved: bool = False
