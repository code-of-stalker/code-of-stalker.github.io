import { router } from 'expo-router';
import { ProductButton, ProductScreen, ProductText } from '../ui';
export function TransitionLabScreen() {
  return <ProductScreen><ProductText variant="title">ПЕРЕХОДЫ</ProductText><ProductText>Три интерактивных варианта доступны по тестовой веб-ссылке.</ProductText><ProductButton label="НАЗАД" onPress={()=>router.back()}/></ProductScreen>;
}
