import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getRelatedRecords from '@salesforce/apex/ListViewController.getRelatedRecords';
import getFieldTypes from '@salesforce/apex/ListViewController.getFieldTypes';
import getPicklistValues from '@salesforce/apex/ListViewController.getPicklistValues';
import deleteRecords from '@salesforce/apex/ListViewController.deleteRecords';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
const actions = [
    { label: 'Edit', name: 'edit' },
    { label: 'Delete', name: 'delete' }
];

export default class ListView extends NavigationMixin(LightningElement) {
    @api recordId;
    @api listOfObjects;
    @api listOfFields;
    @api relationshipField;

    records = [];
    columns = [];
    fieldTypes = {};
    error;
    selectedField = '';
    selectedOperator = '';
    filterValue = '';
    appliedFilters = [];
    filteredRecords = [];
    selectedRecords = [];
    currentPicklistValues = [];
    picklistOptions = {};
    wiredResults;
    currentPage = 1; 
    pageSize = 10;
    totalRecords = 0;
    totalPages = 0;
    paginatedRecords = [];


    connectedCallback() {
        if (this.listOfObjects) {
            this.processedObjectType = this.listOfObjects.toLowerCase();
        }
    }

    @wire(getFieldTypes, { objectApiName: '$listOfObjects' })
    wiredFieldTypes({ error, data }) {
        if (data) {
            console.log('Field Types:', data);
            this.fieldTypes = data;
            this.generateColumns();
        } else if (error) {
            console.error('Error fetching field types:', error);
            this.showToast('Error', error.body.message, 'error');
        }
    }

    @wire(getRelatedRecords, { 
        parentId: '$recordId', 
        relatedObject: '$listOfObjects', 
        fields: '$listOfFields', 
        relationshipField: '$relationshipField' 
    })
    wiredRecords(result) {
        this.wiredResults = result;
    
        if (result.data) {
            console.log('Fetched Records:', result.data);
            
            let fieldsArray = [];
            if (this.listOfFields) {
                if (Array.isArray(this.listOfFields)) {
                    fieldsArray = this.listOfFields;
                } else if (typeof this.listOfFields === 'string') {
                    fieldsArray = this.listOfFields.split(',').map(field => field.trim());
                }
            }
            
            this.records = result.data.map(record => {
                const flattenedRecord = { ...record };
                fieldsArray.forEach(field => {
                    if (field.includes('.')) {
                        const [parent, child] = field.split('.');
                        flattenedRecord[`${parent}_${child}`] = record[parent]?.[child] || 'N/A';
                    }
                });
                return {
                    ...flattenedRecord,
                    recordUrl: `/lightning/r/${this.listOfObjects}/${record.Id}/view`
                };
            });
    
            this.filteredRecords = [...this.records];  // Initialize filteredRecords with all records
            console.log('Mapped Records:', this.records);
            this.generateColumns(fieldsArray);
            this.totalPages = Math.ceil(this.filteredRecords.length / this.pageSize);
            this.updatePaginatedRecords = () => {
                const start = (this.currentPage - 1) * this.pageSize;
                const end = start + this.pageSize;
                this.paginatedRecords = this.filteredRecords.slice(start, end);
                console.log('Paginated Records:', this.paginatedRecords);
            };
    
            this.updatePaginatedRecords();
        } else if (result.error) {
            console.error('Error fetching records:', result.error);
            this.error = result.error;
            this.showToast('Error', this.error.body.message, 'error');
        }
    }
    
    @wire(getPicklistValues, { objectApiName: '$listOfObjects' })
    wiredPicklistValues({ data, error }) {
        if (data) {
            data.forEach(({ fieldApiName, values }) => {
                this.picklistOptions[fieldApiName.toLowerCase()] = values.map(value => ({
                    label: value,
                    value: value
                }));
            });
            console.log('Picklist Options:', JSON.stringify(this.picklistOptions));
        } else if (error) {
            console.error('Error fetching picklist values:', error);
        }
    }
    get iconName() {
        if (!this.processedObjectType) {
            return 'standard:default';
        }
        
        console.log('Icon Name:', this.processedObjectType);
        
        if (this.processedObjectType.endsWith('__c')) {
            return 'standard:default';
        }

        return `standard:${this.processedObjectType}`;
    }

    generateColumns(fieldsArray) {
        if (!fieldsArray || !fieldsArray.length) {
            console.warn('No fields provided for columns.');
            return;
        }
    
        this.columns = fieldsArray.map(field => {
            let label = field.includes('.') ? field.split('.')[1] : field;
            return {
                label: label.replace('__c', '').replace('_', ' '),
                fieldName: field.includes('.') ? field.replace('.', '_') : field,
                type: field.toLowerCase().includes('date') ? 'date' : 'text'
            };
        });
    
        if (this.columns.length) {
            this.columns[0] = {
                ...this.columns[0],
                fieldName: 'recordUrl',
                type: 'url',
                typeAttributes: { label: { fieldName: this.columns[0].fieldName }, target: '_self' }
            };
        }
    
        this.columns.push({ type: 'action', typeAttributes: { rowActions: actions } });
    }


    filterOperators = [
        { label: 'Equals', value: 'equals' },
        { label: 'Contains', value: 'contains' },
        { label: 'Not Equals', value: 'notEquals' },
        { label: 'Not Contains', value: 'notContains' }
    ];

    handleFieldChange(event) {
        this.selectedField = event.detail.value;
        const fieldKey = this.selectedField?.toLowerCase();
        this.selectedFieldType = this.fieldTypes[fieldKey];
    
        if (this.isPicklist) {
            this.currentPicklistValues = this.picklistOptions[fieldKey] || [];
        } else {
            this.currentPicklistValues = [];
        }
        this.filterValue = ''; 
    }
    
    
    handleOperatorChange(event) {
        this.selectedOperator = event.detail.value;
    }

    handleValueChange(event) {
        this.filterValue = event.detail.value;
    }

    handleAddFilter() {
        if (this.selectedField && this.selectedOperator && this.filterValue) {
            const trimmedValue = this.filterValue.trim();
            const filterId = `${this.selectedField}-${this.selectedOperator}-${this.filterValue}`;
            const filterLabel = `${this.selectedField} ${this.selectedOperator} ${this.filterValue}`;
            this.appliedFilters = [
                ...this.appliedFilters,
                { 
                    id: filterId, 
                    label: filterLabel, 
                    fieldName: this.selectedField,
                    operator: this.selectedOperator,
                    value: trimmedValue.toLowerCase()
                }
            ];
            this.fetchFilteredRecords(); 
            console.log('--------->', JSON.stringify(this.appliedFilters));
            this.selectedField = '';
            this.selectedOperator = '';
            this.filterValue = '';
            this.fetchFilteredRecords();
        }
    }
    updatePaginatedRecords() {
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        this.paginatedRecords = this.filteredRecords.slice(start, end);
        console.log('Paginated Records:', this.paginatedRecords);
    }
       
    handlePrevious() {
        if (this.currentPage > 1) {
            this.currentPage -= 1;
            this.updatePaginatedRecords();
        }
    }

    handleNext() {
        if (this.currentPage < this.totalPages) {
            this.currentPage += 1;
            this.updatePaginatedRecords();
        }
    }

    

    fetchFilteredRecords() {
        this.filteredRecords = this.records.filter(record => {
            return this.appliedFilters.every(filter => {
                const { fieldName, operator, value } = filter;
                const fieldValue = record[fieldName]?.toLowerCase();;
    
                if (fieldName === 'recordUrl') {
                    if (operator === 'equals') {
                        return fieldValue === value;
                    } else if (operator === 'contains') {
                        return fieldValue && fieldValue.includes(value);
                    } else if(operator === 'notEquals'){
                        return fieldValue !== value;
                    } else if(operator === 'notContains'){
                        return !fieldValue.includes(value);
                    }
                }
    
                switch (operator) {
                    case 'equals':
                        return fieldValue === value;
                    case 'contains':
                        return fieldValue && fieldValue.includes(value);
                    case  'notEquals':
                        return fieldValue !== value;
                    case 'notContains':
                        return !fieldValue.includes(value);
                    default:
                        return true;
                }
            });
        });
        this.currentPage = 1;
        this.totalRecords = this.filteredRecords.length;     
        this.totalPages = Math.ceil(this.totalRecords / this.pageSize);        
        this.updatePaginatedRecords();
    }

    handleRemoveFilter(event) {
        const filterToRemove = event.target.label;
        this.appliedFilters = this.appliedFilters.filter(
            filter => filter.label !== filterToRemove
        );

        console.log('--------->', JSON.stringify(this.appliedFilters));
        this.fetchFilteredRecords();
    }

    handleSelectedRecords(event){
        const selectedrows = event.detail.selectedRows || [];
        this.selectedRecords = selectedrows.map(row => row.Id); 
        console.log('Selected Records:', JSON.stringify(this.selectedRecords));
    }

    handlebulkDelete() {
        if (!this.selectedRecords.length) {
            this.showToast('Error', 'Please select at least one record to delete', 'error');
            return;
        }
        console.log('180  Selected Records:', JSON.stringify(this.selectedRecords));
        this.handleConfirm(this.selectedRecords); 
    }

    handleConfirm(recordIds){
        if(confirm ('Are you sure you want to delete?')){
            this.handleDelete(recordIds);
        }
    }

    handleRowAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;

        if (actionName === 'delete') {
            this.handleConfirm(row.Id);
        } else if (actionName === 'edit') {
            this.navigateToEditPage(row.Id);
        }
    }

    navigateToEditPage(recordId) {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId,
                objectApiName: this.listOfObjects,
                actionName: 'edit'
            }
        });
    }

        handleDelete(recordIds) {
        console.log('Deleting Records:', recordIds); 
        deleteRecords({ objectApiName: this.listOfObjects, recordIds })
            .then(() => {
                this.showToast('Success', 'Record(s) deleted successfully', 'success');
                this.selectedRecords = []; 
                refreshApex(this.wiredResults); 
            })
            .catch(error => {
                console.error('Delete Error:', error);
                this.showToast('Error', error.body.message, 'error');
            });
    }

    get options() {
        if (this.listOfFields) {
            const fieldsArray = Array.isArray(this.listOfFields)
                ? this.listOfFields
                : this.listOfFields.split(',').map(field => field.trim());
    
            return fieldsArray.map(field => ({
                label: field.replace('__c', '').replace('_', ' '),
                value: field
            }));
        }
        return [];
    }

    get isPreviousDisabled() {
        return this.currentPage === 1;
    }
    
    get isNextDisabled() {
        return this.currentPage === this.totalPages || this.totalPages === 0;
    }

    get isPicklist() {
        return this.selectedFieldType?.toLowerCase() === 'picklist';
    }

    

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }

}