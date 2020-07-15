@IsTest
private class FiveNineSocketAuraServiceTest {

	static TestMethod void getFive9Config_givenNothing_shouldGetViewModel() {
		Boolean isFive9User = getIsFive9User();

		Test.startTest();

			String response = FiveNineSocketAuraService.getFive9Config();

		Test.stopTest();

		FiveNineSocketAuraService.ViewModel vm = (FiveNineSocketAuraService.ViewModel) JSON.deserialize(response, FiveNineSocketAuraService.ViewModel.class);
		System.assertEquals(isFive9User, vm.isFive9User, 'Should indicate if this user is configured for Five9.');
		System.assertEquals(3, vm.resources.size(), 'Should have 3 CustomMetadata Records.');
	}

	private static Boolean getIsFive9User () {
		Set<Id> callCenterIds = new Set<Id>();
		for (CallCenter cc : [SELECT Id FROM CallCenter WHERE Name LIKE 'Five9%']) {
			callCenterIds.add(cc.Id);
		}
		User currentUser = [SELECT CallCenterId from User WHERE Id = :UserInfo.getUserId()];

		return callCenterIds.contains(currentUser.CallCenterId);
	}
}