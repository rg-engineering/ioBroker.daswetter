var data = 
{'report':
    {'location':
        [
    {'$':
        {'city':'Rodewisch [Sachsen;Deutschland]'},'interesting':[{'url':[{'_':'https://www.daswetter.com/wetter_Rodewisch-Europa-Deutschland-Sachsen--1-27287.html','$':{'description':'vorhersage'}}]}],
            
            'var':
            [
            {'name':['minimale Temperatur'],'icon':['4'],'data':
                    [{'forecast':
                    [   {'$':{'data_sequence':'1','value':'4'}},
                        {'$':{'data_sequence':'2','value':'2'}},
                        {'$':{'data_sequence':'3','value':'2'}},
                        {'$':{'data_sequence':'4','value':'3'}},
                        {'$':{'data_sequence':'5','value':'2'}},
                        {'$':{'data_sequence':'6','value':'1'}},
                        {'$':{'data_sequence':'7','value':'-2'}}]}]},
            {'name':['maximale Temperatur'],'icon':['5'],'data':
                [{'forecast':[{'$':{'data_sequence':'1','value':'10'}},{'$':{'data_sequence':'2','value':'9'}},{'$':{'data_sequence':'3','value':'13'}},{'$':{'data_sequence':'4','value':'14'}},{'$':{'data_sequence':'5','value':'13'}},{'$':{'data_sequence':'6','value':'12'}},{'$':{'data_sequence':'7','value':'9'}}]}]},{'name':['Wind'],'icon':['9'],'data':[{'forecast':[{'$':{'data_sequence':'1','id':'22','idB':'62','value':'Starker Südwestwind','valueB':'Starker Wind aus Südwesten'}},{'$':{'data_sequence':'2','id':'11','idB':'43','value':'Mäßiger Ostwind','valueB':'Mäßiger Wind aus Osten'}},{'$':{'data_sequence':'3','id':'12','idB':'36','value':'Mäßiger Südostwind','valueB':'Mäßiger Wind aus Südosten'}},{'$':{'data_sequence':'4','id':'10','idB':'34','value':'Mäßiger Nordostwind','valueB':'Mäßiger Wind aus Nordosten'}},{'$':{'data_sequence':'5','id':'10','idB':'42','value':'Mäßiger Nordostwind','valueB':'Mäßiger Wind aus Nordosten'}},{'$':{'data_sequence':'6','id':'10','idB':'42','value':'Mäßiger Nordostwind','valueB':'Mäßiger Wind aus Nordosten'}},{'$':{'data_sequence':'7','id':'11','idB':'51','value':'Mäßiger Ostwind','valueB':'Mäßiger Wind aus Osten'}}]}]},{'name':['Variable Symbol'],'icon':['10'],'data':[{'forecast':[{'$':{'data_sequence':'1','id':'6','id2':'6','value':'Bewölkt mit leichtem Regen','value2':'Bewölkt mit leichtem Regen'}},{'$':{'data_sequence':'2','id':'7','id2':'7','value':'Bedeckt mit leichtem Regen','value2':'Bedeckt mit leichtem Regen'}},{'$':{'data_sequence':'3','id':'6','id2':'6','value':'Bewölkt mit leichtem Regen','value2':'Bewölkt mit leichtem Regen'}},{'$':{'data_sequence':'4','id':'3','id2':'3','value':'Bewölkt','value2':'Bewölkt'}},{'$':{'data_sequence':'5','id':'1','id2':'1','value':'Sonnig','value2':'Sonnig'}},{'$':{'data_sequence':'6','id':'1','id2':'1','value':'Sonnig','value2':'Sonnig'}},{'$':{'data_sequence':'7','id':'1','id2':'1','value':'Sonnig','value2':'Sonnig'}}]}]},{'name':['Tag'],'icon':['15'],'data':[{'forecast':[{'$':{'data_sequence':'1','value':'Dienstag'}},{'$':{'data_sequence':'2','value':'Mittwoch'}},{'$':{'data_sequence':'3','value':'Donnerstag'}},{'$':{'data_sequence':'4','value':'Freitag'}},{'$':{'data_sequence':'5','value':'Samstag'}},{'$':{'data_sequence':'6','value':'Sonntag'}},{'$':{'data_sequence':'7','value':'Montag'}}]}]},{'name':['Definition Atmosphäre'],'icon':['19'],'data':[{'forecast':[{'$':{'data_sequence':'1','value':'Während der ersten Hälfte des Tages Teils bewölkt tendenziell in der zweiten Hälfte des Tages Bewölkt mit leichtem Regen'}},{'$':{'data_sequence':'2','value':'Während der ersten Hälfte des Tages Bewölkt tendenziell in der zweiten Hälfte des Tages Bewölkt mit leichtem Regen'}},{'$':{'data_sequence':'3','value':'Während der ersten Hälfte des Tages Bewölkt mit leichtem Regen tendenziell in der zweiten Hälfte des Tages Teils bewölkt'}},{'$':{'data_sequence':'4','value':'Während der ersten Hälfte des Tages Teils bewölkt tendenziell in der zweiten Hälfte des Tages Sonne'}},{'$':{'data_sequence':'5','value':'Den ganzen Tag über Sonne'}},{'$':{'data_sequence':'6','value':'Den ganzen Tag über Sonne'}},{'$':{'data_sequence':'7','value':'Den ganzen Tag über Sonne'}}]}]}]}]}};

test3 = data.report.location[0].var[0].data[0].forecast[0].$.value;






