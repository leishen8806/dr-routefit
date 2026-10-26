-- A device is registered to one driver; a shift or point must not claim another.
ALTER TABLE mobile.device
 ADD CONSTRAINT device_company_driver_key UNIQUE(company_id,id,driver_id);

ALTER TABLE mobile.shift
 ADD CONSTRAINT shift_device_driver_fk
 FOREIGN KEY(company_id,device_id,driver_id) REFERENCES mobile.device(company_id,id,driver_id);

ALTER TABLE mobile.location_event
 ADD CONSTRAINT location_event_device_driver_fk
 FOREIGN KEY(company_id,device_id,driver_id) REFERENCES mobile.device(company_id,id,driver_id);
