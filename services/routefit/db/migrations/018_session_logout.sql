ALTER TABLE integration.http_request_result DROP CONSTRAINT http_request_result_status_check;
ALTER TABLE integration.http_request_result ADD CONSTRAINT http_request_result_status_check CHECK(status IN (200,201,202,204));
