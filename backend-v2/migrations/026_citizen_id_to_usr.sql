-- 026：公民号统一为 USR- 口径（v0.2.51.1 用户「能不能把CIT改成USR？」）
-- citizen_id 归位为用户 id（USR-）：旧 CIT- 存量改写、NULL 补齐、已一致的不动。
UPDATE users SET citizen_id = id WHERE citizen_id IS NULL OR citizen_id != id;
