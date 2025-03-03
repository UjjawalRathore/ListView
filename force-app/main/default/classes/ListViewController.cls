public with sharing class ListViewController {
    @AuraEnabled(cacheable=true)
    public static List<SObject> getRelatedRecords(Id parentId, String relatedObject, String fields, String relationshipField) {
        String query = '';
        
        if (relatedObject == 'Task' || relatedObject == 'Event') {
            query = 'SELECT ' + fields + ' FROM ' + relatedObject + ' WHERE (WhatId = :parentId OR WhoId = :parentId)';
        } else {
            query = 'SELECT ' + fields + ' FROM ' + relatedObject + ' WHERE ' + relationshipField + ' = :parentId';
        }

        return Database.query(query);
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, String> getFieldTypes(String objectApiName) {
        Map<String, String> fieldTypes = new Map<String, String>();
        
        Schema.SObjectType objectType = Schema.getGlobalDescribe().get(objectApiName);
        
        Schema.DescribeSObjectResult objectDescribe = objectType.getDescribe();
        
        Map<String, Schema.SObjectField> fields = objectDescribe.fields.getMap();
        
        for (String fieldName : fields.keySet()) {
            Schema.SObjectField field = fields.get(fieldName);
            Schema.DescribeFieldResult fieldDescribe = field.getDescribe();
            
            String fieldType = fieldDescribe.getType().name();
            
            fieldTypes.put(fieldName, fieldType);
        }
        
        return fieldTypes;
    }

    @AuraEnabled
    public static void deleteRecords(String objectApiName, List<Id> recordIds) {
        if (String.isBlank(objectApiName) || recordIds == null || recordIds.isEmpty()) {
            throw new AuraHandledException('Invalid input. Object API Name and Record IDs are required.');
        }
        
        try {
            // Create a list of SObjects dynamically
            List<SObject> recordsToDelete = new List<SObject>();
            for (Id recordId : recordIds) {
                SObject record = Schema.getGlobalDescribe().get(objectApiName).newSObject(recordId);
                recordsToDelete.add(record);
            }
            
            // Perform the delete operation
            Database.delete(recordsToDelete, false); // False to allow partial success
        } catch (Exception e) {
            throw new AuraHandledException(
                'Failed to delete records. Error: ' + e.getMessage()
            );
        }
    }
    @AuraEnabled(cacheable=true)
public static List<PicklistOption> getPicklistValues(String objectApiName) {
    Map<String, List<String>> picklistData = new Map<String, List<String>>();

    Schema.DescribeSObjectResult objectDescribe = Schema.getGlobalDescribe().get(objectApiName).getDescribe();
    Map<String, Schema.SObjectField> fields = objectDescribe.fields.getMap();

    for (String fieldName : fields.keySet()) {
        Schema.DescribeFieldResult fieldDescribe = fields.get(fieldName).getDescribe();

        if (fieldDescribe.getType() == Schema.DisplayType.Picklist) {
            List<Schema.PicklistEntry> picklistEntries = fieldDescribe.getPicklistValues();
            List<String> values = new List<String>();

            for (Schema.PicklistEntry entry : picklistEntries) {
                values.add(entry.getLabel());
            }
            picklistData.put(fieldName, values);
        }
    }

    List<PicklistOption> results = new List<PicklistOption>();
    for (String key : picklistData.keySet()) {
        results.add(new PicklistOption(key, picklistData.get(key)));
    }
    return results;
}
public class PicklistOption {
    @AuraEnabled public String fieldApiName;
    @AuraEnabled public List<String> values;

    public PicklistOption(String fieldApiName, List<String> values) {
        this.fieldApiName = fieldApiName;
        this.values = values;
    }
}
    
}