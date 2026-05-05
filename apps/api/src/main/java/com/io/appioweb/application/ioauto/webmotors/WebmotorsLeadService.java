package com.io.appioweb.application.ioauto.webmotors;

import com.io.appioweb.adapters.persistence.ioauto.JpaWebmotorsLeadEntity;
import com.io.appioweb.application.ioauto.webmotors.modules.leads.WmLeadsService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class WebmotorsLeadService {

    private final WmLeadsService leadsService;

    public WebmotorsLeadService(WmLeadsService leadsService) {
        this.leadsService = leadsService;
    }

    public List<JpaWebmotorsLeadEntity> listLeads(UUID companyId) {
        return leadsService.listLeads(companyId);
    }

    public List<JpaWebmotorsLeadEntity> pullLeads(UUID companyId, String storeKey, String since) {
        return leadsService.pullLeads(companyId, storeKey, since);
    }

    public JpaWebmotorsLeadEntity processCallback(UUID companyId, String storeKey, Map<String, String> headers, String payloadJson) {
        return leadsService.processCallback(companyId, storeKey, headers, payloadJson);
    }
}
