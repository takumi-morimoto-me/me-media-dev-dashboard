# ASP Implementation Status

## Implemented ASPs (16)

| ASP Name | Scraper | Status |
|----------|---------|--------|
| A8.net | ✅ | Production ready |
| もしもアフィリエイト | ✅ | Production ready |
| Link-AG | ✅ | Production ready |
| felmat | ✅ | Production ready |
| afb | ✅ | Production ready |
| アクセストレード | ✅ | Testing required |
| Amazonアソシエイト | ✅ | Testing required |
| DMMアフィリエイト | ✅ | Testing required |
| リンクシェア | ✅ | Testing required |
| バリューコマース | ✅ | Testing required |
| JANet | ✅ | Testing required |
| TGアフィリエイト | ✅ | Testing required |
| レントラックス | ✅ | Testing required |
| Smart-C | ✅ | Testing required |
| i-mobile | ✅ | Testing required |
| Zucks Affiliate | ✅ | Testing required |

## Pending Implementation (14)

ASPs with credentials saved in Supabase, but scrapers not yet implemented.

### Medium Priority

| No | ASP Name | Priority | Notes |
|----|----------|----------|-------|
| 1 | SLVRbullet | Medium | - |
| 2 | affitown | Medium | - |
| 3 | A8app | Medium | A8 app version |
| 4 | PRESCO | Medium | - |

### Low Priority

| No | ASP Name | Priority | Notes |
|----|----------|----------|-------|
| 5 | ドコモアフィリエイト | Low | Limited scope |
| 6 | CircuitX | Low | Closed ASP |
| 7 | SmaAD | Low | - |
| 8 | SKYFLAG | Low | - |
| 9 | アルテガアフィリエイト | Low | - |
| 10 | Ratel AD | Low | - |
| 11 | CASTALK | Low | - |
| 12 | Gro-fru | Low | - |
| 13 | Sphere | Low | - |
| 14 | webridge | Low | - |

## Not Registered in ASPs Table

The following ASPs have credentials but are not registered in the `asps` table:

1. SeedApp(ビギナーズ)
2. Presco（ビギナーズ）
3. Webridge (should be: webridge)
4. yahooアドパートナー
5. iTunes(ビギナーズ)
6. Poets
7. SCAN
8. DMMアフィリエイト(電子書籍特単用)
9. looopでんき
10. flowkey
11. ENEOSでんき
12. callawaygolfjp
13. gopro

## Implementation Guide

### Recommended Implementation Order

1. **afb** - High demand, major ASP
2. **アクセストレード** - High demand, major ASP
3. **Amazonアソシエイト** - Amazon official

### Implementation Steps

For each ASP scraper:

1. Research login page structure
2. Research report page structure
3. Use existing scrapers (Link-AG, felmat) as templates
4. Implement the scraper
5. Test execution
6. Verify data is saved to Supabase

### Template Files

- `src/scripts/linkag-daily-scraper.ts` - Good template for daily reports
- `src/scripts/felmat-daily-scraper.ts` - Alternative template

### Testing Checklist

- [ ] Login successful
- [ ] Navigate to report page
- [ ] Extract data correctly
- [ ] Save to Supabase
- [ ] Handle errors gracefully
- [ ] Screenshot capture works (for debugging)
