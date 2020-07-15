public with sharing class FiveNineSocketAuraService {
	@AuraEnabled(cacheable=true)
	public static String getFive9Config () {
		Set<Id> five9CallCenters = new Set<Id>();
		for (CallCenter cc : [SELECT Id FROM CallCenter WHERE Name LIKE 'Five9%']) {
			five9CallCenters.add(cc.Id);
		}
		User currentUser = [SELECT CallCenterId from User WHERE Id = :UserInfo.getUserId()];

		ViewModel vm = new ViewModel();
		vm.isFive9User = five9CallCenters.contains(currentUser.CallCenterId);
		vm.resources = [
			SELECT Id,
				BaseUrl__c,
				DeveloperName,
				MasterLabel,
				Protocol__c,
				ResourceURL__c
			FROM FiveNineResource__mdt];

			return JSON.serialize(vm);
	}

	public class ViewModel {
		public Boolean isFive9User {get;set;}
		public List<FiveNineResource__mdt> resources {get;set;}
	}
}