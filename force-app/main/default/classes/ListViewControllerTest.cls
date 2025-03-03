@isTest
public class ListViewControllerTest {
    
    @testSetup
    static void setupTestData() {
        Account acc = new Account(Name = 'Test Account');
        insert acc;
        
        Contact con = new Contact(FirstName = 'Test', LastName = 'Contact', Phone = '9900990099', AccountId = acc.Id);
        insert con;
        
        Task task = new Task(Subject = 'Test Task', WhatId = acc.Id, Status = 'Not Started');
        insert task;

        // Ensure the custom object exists before inserting
        if (Schema.getGlobalDescribe().containsKey('CustomObject__c')) {
            SObject customRecord = Schema.getGlobalDescribe().get('CustomObject__c').newSObject();
            customRecord.put('Name', 'Test Custom Record');
            customRecord.put('Account__c', acc.Id); // Assuming lookup field to Account
            insert customRecord;
        }
    }

    @isTest
    static void testGetRelatedRecords_StandardObjects() {
        Account acc = [SELECT Id FROM Account LIMIT 1];

        Test.startTest();
        List<SObject> records = ListViewController.getRelatedRecords(acc.Id, 'Task', 'Id, Subject, Status', 'WhatId');
        Test.stopTest();

        System.assertNotEquals(0, records.size(), 'Related Task records should be returned');
    }

    @isTest
    static void testGetRelatedRecords_CustomObject() {
        if (!Schema.getGlobalDescribe().containsKey('CustomObject__c')) {
            System.debug('Skipping test: CustomObject__c does not exist.');
            return;
        }

        Account acc = [SELECT Id FROM Account LIMIT 1];

        Test.startTest();
        List<SObject> records = ListViewController.getRelatedRecords(acc.Id, 'CustomObject__c', 'Id, Name, Account__c', 'Account__c');
        Test.stopTest();

        System.assert(records.size() > 0, 'Related CustomObject__c records should be returned');
    }


    @isTest
    static void testGetFieldTypes() {
        Test.startTest();
        Map<String, String> fieldTypes = ListViewController.getFieldTypes('Account');
        Test.stopTest();

        //System.assert(fieldTypes.containsKey('Name'), 'Field types should contain Name field');
        //System.assertEquals('STRING', fieldTypes.get('Name'), 'Name field should be of type STRING or TEXT');
    }

   @isTest
    static void testDeleteRecords() {
        Account acc = new Account(Name = 'Delete Test Account');
        insert acc;

        Test.startTest();
        ListViewController.deleteRecords('Account', new List<Id>{acc.Id});
        Test.stopTest();

        Account[] deletedAcc = [SELECT Id, IsDeleted FROM Account WHERE Id = :acc.Id ALL ROWS];
        System.assert(deletedAcc[0].IsDeleted, 'Account should be deleted');
    }

    @isTest
    static void testGetPicklistValues() {
        Test.startTest();
        List<ListViewController.PicklistOption> picklists = ListViewController.getPicklistValues('Account');
        Test.stopTest();

        System.assert(picklists.size() > 0, 'Picklist values should be returned');
    }
}